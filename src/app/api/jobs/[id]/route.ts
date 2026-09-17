import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth';
import { refundQuota, usagePeriod } from '@/lib/entitlements-server';
import { resolveEntitlements } from '@/lib/entitlements';

export const runtime = 'nodejs';

// GET /api/jobs/[id] - Get generation job status with progress
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    let job = await db.generationJob.findFirst({
      where: { id, userId: user.id },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
    });

    if (!job) {
      return NextResponse.json(
        { error: 'Job non trouvé' },
        { status: 404 }
      );
    }

    // A detached local generation can die with its process. Polling performs a
    // lazy watchdog so a stranded spinner eventually becomes an actionable failure.
    const staleBefore = new Date(Date.now() - 45 * 60_000);
    if ((job.status === 'PROCESSING' || job.status === 'PENDING') && job.updatedAt < staleBefore) {
      const claimed = await db.generationJob.updateMany({
        where: { id: job.id, userId: user.id, status: job.status, updatedAt: { lt: staleBefore } },
        data: {
          status: 'FAILED',
          progressMessage: 'La génération a expiré. Réessayez.',
          errorMessage: 'GENERATION_TIMEOUT',
          completedAt: new Date(),
        },
      });
      if (claimed.count === 1) {
        await refundQuota(user.id, 'generation', usagePeriod(job.startedAt ?? job.createdAt));
        await db.project.updateMany({
          where: { id: job.projectId, userId: user.id, status: job.type === 'report' ? 'GENERATING' : 'SUMMARIZING' },
          data: { status: job.type === 'report' ? 'SUMMARY_READY' : 'DRAFT' },
        });
      }
      job = await db.generationJob.findFirstOrThrow({
        where: { id, userId: user.id },
        include: { project: { select: { id: true, title: true, status: true } } },
      });
    }

    // Parse output data if present
    let parsedOutputData: unknown = null;
    if (job.outputData) {
      try {
        parsedOutputData = JSON.parse(job.outputData);
      } catch {
        parsedOutputData = job.outputData;
      }
    }

    const canViewOutline = resolveEntitlements(user).tableOfContents;
    return NextResponse.json({
      job: {
        ...job,
        progressMessage: !canViewOutline && job.type === 'report'
          ? job.status === 'FAILED' ? 'Échec de la génération du rapport' : job.status === 'COMPLETED' ? 'Rapport généré' : 'Rédaction du rapport en cours…'
          : job.progressMessage,
        outputData: canViewOutline ? parsedOutputData : null,
        errorMessage: null,
      },
    });
  } catch (error) {
    console.error('GET /api/jobs/[id] error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du job' },
      { status: 500 }
    );
  }
}
