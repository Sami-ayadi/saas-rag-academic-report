import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod/v4';
import { getAuthenticatedUser } from '@/lib/auth';
import { apiRequestErrorResponse, readJsonBody } from '@/lib/api-input';
import { notifyAdministrators } from '@/lib/notifications';

export const runtime = 'nodejs';

const createProjectSchema = z.object({
  title: z.string().min(1, 'Le titre est requis').max(200),
  brief: z.string().max(2000).optional(),
  academicLevel: z.string().optional().default('Master'),
  university: z.string().trim().max(200).optional(),
  field: z.string().trim().max(100).optional(),
  language: z.string().optional().default('fr'),
}).strict();

// GET /api/projects - Users see their projects; administrators see the full platform portfolio.
export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const projects = await db.project.findMany({
      where: user.role === 'ADMIN' ? undefined : { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: {
            documents: true,
            summaries: true,
            reports: true,
            jobs: true,
          },
        },
      },
    });

    // For each project, get the latest report if any
    const projectsWithDetails = await Promise.all(
      projects.map(async (project) => {
        const latestReport = await db.report.findFirst({
          where: { projectId: project.id },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
          },
        });

        const { user: owner, ...projectDetails } = project;
        return { ...projectDetails, owner, latestReport };
      })
    );

    return NextResponse.json({ projects: projectsWithDetails, scope: user.role === 'ADMIN' ? 'ALL' : 'OWN' });
  } catch (error) {
    console.error('GET /api/projects error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des projets' },
      { status: 500 }
    );
  }
}

// POST /api/projects - Create a new project
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const validated = await readJsonBody(request, createProjectSchema);

    const project = await db.$transaction(async (transaction) => {
      const created = await transaction.project.create({
        data: {
          title: validated.title,
          brief: validated.brief,
          academicLevel: validated.academicLevel,
          university: validated.university,
          field: validated.field,
          language: validated.language,
          userId: user.id,
        },
      });
      const owner = await transaction.user.findUnique({ where: { id: user.id }, select: { name: true, email: true } });
      await notifyAdministrators({
        type: 'PROJECT_CREATED',
        title: 'Nouveau projet créé',
        message: `${owner?.name ?? owner?.email ?? user.id} a créé « ${created.title} »`,
        linkView: 'dashboard',
        metadata: { projectId: created.id, ownerId: user.id },
      }, [user.id], transaction);
      return created;
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error('POST /api/projects error:', error);
    const requestError = apiRequestErrorResponse(error);
    if (requestError) return requestError;
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Erreur lors de la création du projet' },
      { status: 500 }
    );
  }
}
