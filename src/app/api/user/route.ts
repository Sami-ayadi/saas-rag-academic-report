import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

// GET /api/user - Get current user info with usage stats
export async function GET() {
  try {
    // In a real app, we'd get the user from the session
    // For demo, use the demo user
    const user = await db.user.findUnique({
      where: { email: 'demo@rapportgen.fr' },
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

    return NextResponse.json({
      user,
      usageStats,
    });
  } catch (error) {
    console.error('GET /api/user error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des informations utilisateur' },
      { status: 500 }
    );
  }
}
