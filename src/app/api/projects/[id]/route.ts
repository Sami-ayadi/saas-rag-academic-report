import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod/v4';
import { getAuthenticatedUser } from '@/lib/auth';
import { apiRequestErrorResponse, readJsonBody } from '@/lib/api-input';
import { resolveEntitlements } from '@/lib/entitlements';
import { publicReportFailureMessage } from '@/lib/llm-errors';
import { removeProjectStorage } from '@/lib/storage';

export const runtime = 'nodejs';

const updateProjectSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  brief: z.string().max(2000).optional(),
  academicLevel: z.string().optional(),
  university: z.string().trim().max(200).optional(),
  field: z.string().trim().max(100).optional(),
}).strict();

// GET /api/projects/[id] - Get single project with all relations
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const project = await db.project.findFirst({
      where: { id, userId: user.id },
      include: {
        documents: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            projectId: true,
            originalName: true,
            mimeType: true,
            size: true,
            status: true,
            chunkCount: true,
            role: true,
            pageCount: true,
            extractionError: true,
            processedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        summaries: {
          orderBy: { createdAt: 'desc' },
        },
        reportPlans: {
          orderBy: { version: 'desc' },
          take: 1,
          select: {
            id: true,
            version: true,
            templateKey: true,
            content: true,
            status: true,
            approvedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        reports: {
          orderBy: { createdAt: 'desc' },
          // Metadata only — the stored body, section payload and protected
          // outline must never leave the server through the project route.
          select: {
            id: true,
            title: true,
            status: true,
            wordCount: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        jobs: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Projet non trouvé' },
        { status: 404 }
      );
    }

    const canViewOutline = resolveEntitlements(user).tableOfContents;
    return NextResponse.json({ project: {
      ...project,
      jobs: project.jobs.map((job) => ({
        ...job,
        progressMessage: !canViewOutline && job.type === 'report'
          ? job.status === 'FAILED' ? publicReportFailureMessage(job.progressMessage) : job.status === 'COMPLETED' ? 'Rapport généré' : 'Rédaction du rapport en cours…'
          : job.progressMessage,
        outputData: canViewOutline && (job.type !== 'report' || job.status === 'COMPLETED') ? job.outputData : null,
        errorMessage: null,
      })),
    } });
  } catch (error) {
    console.error('GET /api/projects/[id] error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du projet' },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/[id] - Update project
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const validated = await readJsonBody(request, updateProjectSchema);

    const project = await db.project.findFirst({ where: { id, userId: user.id } });

    if (!project) {
      return NextResponse.json(
        { error: 'Projet non trouvé' },
        { status: 404 }
      );
    }

    const updated = await db.project.update({
      where: { id },
      data: validated,
    });

    return NextResponse.json({ project: updated });
  } catch (error) {
    console.error('PATCH /api/projects/[id] error:', error);
    const requestError = apiRequestErrorResponse(error);
    if (requestError) return requestError;
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du projet' },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id] - Delete project and all related data
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const project = await db.project.findFirst({ where: { id, userId: user.id } });

    if (!project) {
      return NextResponse.json(
        { error: 'Projet non trouvé' },
        { status: 404 }
      );
    }

    await removeProjectStorage(user.id, id);

    await db.$transaction([
      db.apiUsage.deleteMany({ where: { projectId: id, userId: user.id } }),
      db.embedding.deleteMany({ where: { projectId: id } }),
      db.generationJob.deleteMany({ where: { projectId: id, userId: user.id } }),
      db.report.deleteMany({ where: { projectId: id } }),
      db.summary.deleteMany({ where: { projectId: id } }),
      db.document.deleteMany({ where: { projectId: id } }),
      db.project.delete({ where: { id } }),
    ]);

    return NextResponse.json({
      message: 'Projet supprimé avec succès',
    });
  } catch (error) {
    console.error('DELETE /api/projects/[id] error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du projet' },
      { status: 500 }
    );
  }
}
