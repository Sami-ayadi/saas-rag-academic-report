import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod/v4';

export const runtime = 'nodejs';

const updateProjectSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  brief: z.string().max(2000).optional(),
  academicLevel: z.string().optional(),
  university: z.string().optional(),
  field: z.string().optional(),
  status: z.enum(['DRAFT', 'SUMMARIZING', 'SUMMARY_READY', 'GENERATING', 'REPORT_READY', 'EXPORTED']).optional(),
});

// GET /api/projects/[id] - Get single project with all relations
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const project = await db.project.findUnique({
      where: { id },
      include: {
        documents: {
          orderBy: { createdAt: 'desc' },
        },
        summaries: {
          orderBy: { createdAt: 'desc' },
        },
        reports: {
          orderBy: { createdAt: 'desc' },
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

    return NextResponse.json({ project });
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
    const body = await request.json();
    const validated = updateProjectSchema.parse(body);

    const project = await db.project.findUnique({ where: { id } });

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

    const project = await db.project.findUnique({ where: { id } });

    if (!project) {
      return NextResponse.json(
        { error: 'Projet non trouvé' },
        { status: 404 }
      );
    }

    // Delete related records (cascade should handle this, but let's be explicit)
    await db.apiUsage.deleteMany({ where: { projectId: id } });
    await db.embedding.deleteMany({ where: { projectId: id } });
    await db.generationJob.deleteMany({ where: { projectId: id } });
    await db.report.deleteMany({ where: { projectId: id } });
    await db.summary.deleteMany({ where: { projectId: id } });
    await db.document.deleteMany({ where: { projectId: id } });
    await db.project.delete({ where: { id } });

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
