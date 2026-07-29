import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod/v4';

export const runtime = 'nodejs';

const createProjectSchema = z.object({
  title: z.string().min(1, 'Le titre est requis').max(200),
  brief: z.string().max(2000).optional(),
  academicLevel: z.string().optional().default('Master'),
  university: z.string().optional(),
  field: z.string().optional(),
  language: z.string().optional().default('fr'),
});

// GET /api/projects - List all projects with details
export async function GET() {
  try {
    const projects = await db.project.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
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

        return {
          ...project,
          latestReport,
        };
      })
    );

    return NextResponse.json({ projects: projectsWithDetails });
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
    const body = await request.json();
    const validated = createProjectSchema.parse(body);

    const project = await db.project.create({
      data: {
        title: validated.title,
        brief: validated.brief,
        academicLevel: validated.academicLevel,
        university: validated.university,
        field: validated.field,
        language: validated.language,
        userId: 'demo-user-001',
      },
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error('POST /api/projects error:', error);
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
