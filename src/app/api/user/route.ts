import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth';
import { resolveEntitlements } from '@/lib/entitlements';
import { quotaSnapshot, usagePeriod } from '@/lib/entitlements-server';
import { apiRequestErrorResponse, readJsonBody } from '@/lib/api-input';
import { getStripeClient, isStripeConfigured } from '@/lib/stripe';
import { removeProjectStorage } from '@/lib/storage';

export const runtime = 'nodejs';

// GET /api/user - Get current user info with usage stats
export async function GET() {
  try {
    const authenticatedUser = await getAuthenticatedUser();
    if (!authenticatedUser) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: authenticatedUser.id },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        university: true,
        tier: true,
        role: true,
        isActive: true,
        creditsUsed: true,
        creditsLimit: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé' },
        { status: 404 }
      );
    }

    // Calculate usage stats
    const totalProjects = await db.project.count({
      where: { userId: user.id },
    });

    const totalDocuments = await db.document.count({
      where: { project: { userId: user.id } },
    });

    const totalReports = await db.report.count({
      where: { project: { userId: user.id } },
    });

    // Calculate this month's usage
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyUsage = await db.apiUsage.aggregate({
      where: {
        userId: user.id,
        createdAt: { gte: startOfMonth },
      },
      _sum: {
        costUsd: true,
        inputTokens: true,
        outputTokens: true,
      },
    });

    const usageStats = {
      totalProjects,
      totalDocuments,
      totalReports,
      totalCreditsUsed: user.creditsUsed,
      creditsRemaining: user.creditsLimit - user.creditsUsed,
      thisMonthUsage: {
        costUsd: monthlyUsage._sum.costUsd ?? 0,
        inputTokens: monthlyUsage._sum.inputTokens ?? 0,
        outputTokens: monthlyUsage._sum.outputTokens ?? 0,
      },
    };

    // Canonical entitlement snapshot so dashboards render exactly what the
    // server enforces, including administrator credit overrides.
    const entitlements = resolveEntitlements(authenticatedUser);
    const quota = await quotaSnapshot(user.id, entitlements, usagePeriod());

    return NextResponse.json({
      user: { ...user, email: user.email ?? '' },
      usageStats,
      entitlements: {
        tier: entitlements.tier,
        accountTier: entitlements.accountTier,
        activeProjects: entitlements.activeProjects,
        documentsPerProject: entitlements.documentsPerProject,
        maxUploadBytes: entitlements.maxUploadBytes,
        exportFormats: entitlements.exportFormats,
        previewPages: entitlements.previewPages,
        tableOfContents: entitlements.tableOfContents,
        canEditReport: entitlements.canEditReport,
      },
      quota,
    });
  } catch (error) {
    console.error('GET /api/user error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des informations utilisateur' },
      { status: 500 }
    );
  }
}

const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(120),
  university: z.string().trim().max(200),
}).strict();

export async function PATCH(request: NextRequest) {
  try {
    const authenticatedUser = await getAuthenticatedUser();
    if (!authenticatedUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const payload = await readJsonBody(request, updateProfileSchema);
    const user = await db.user.update({
      where: { id: authenticatedUser.id },
      data: { name: payload.name, university: payload.university || null },
      select: { id: true, email: true, name: true, university: true, image: true, tier: true, role: true },
    });
    return NextResponse.json({ user });
  } catch (error) {
    const requestError = apiRequestErrorResponse(error);
    if (requestError) return requestError;
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Profil invalide', details: error.issues }, { status: 400 });
    console.error('PATCH /api/user error:', error);
    return NextResponse.json({ error: 'Impossible de mettre à jour le profil' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const authenticatedUser = await getAuthenticatedUser();
    if (!authenticatedUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const user = await db.user.findUnique({
      where: { id: authenticatedUser.id },
      select: { id: true, stripeSubId: true, projects: { select: { id: true } } },
    });
    if (!user) return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    if (user.stripeSubId) {
      if (!isStripeConfigured()) {
        return NextResponse.json({ error: 'La facturation doit être disponible pour annuler l’abonnement avant suppression.' }, { status: 503 });
      }
      await getStripeClient().subscriptions.cancel(user.stripeSubId, { prorate: false });
    }
    for (const project of user.projects) await removeProjectStorage(user.id, project.id);
    await db.user.delete({ where: { id: user.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/user error:', error);
    return NextResponse.json({ error: 'Impossible de supprimer complètement le compte.' }, { status: 500 });
  }
}
