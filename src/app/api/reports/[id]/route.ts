import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth';
import { z } from 'zod/v4';
import { apiRequestErrorResponse, readJsonBody } from '@/lib/api-input';

export const runtime = 'nodejs';

const updateReportSchema = z.object({
  content: z.string().max(500_000).optional(),
  sectionId: z.string().trim().min(1).max(100).optional(),
  sectionContent: z.string().max(100_000).optional(),
}).strict().refine(
  (value) => value.content !== undefined || (value.sectionId !== undefined && value.sectionContent !== undefined),
  { message: 'Spécifiez content ou sectionId avec sectionContent' },
);

// GET /api/reports/[id] - Get single report with full content
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const report = await db.report.findFirst({
      where: { id, project: { userId: user.id } },
      include: {
        summary: true,
        project: {
          select: {
            id: true,
            title: true,
            academicLevel: true,
            university: true,
            field: true,
            language: true,
          },
        },
      },
    });

    if (!report) {
      return NextResponse.json(
        { error: 'Rapport non trouvé' },
        { status: 404 }
      );
    }

    return NextResponse.json({ report });
  } catch (error) {
    console.error('GET /api/reports/[id] error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du rapport' },
      { status: 500 }
    );
  }
}

// PATCH /api/reports/[id] - Update report content or specific section
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const report = await db.report.findFirst({
      where: { id, project: { userId: user.id } },
    });

    if (!report) {
      return NextResponse.json(
        { error: 'Rapport non trouvé' },
        { status: 404 }
      );
    }

    const { content, sectionId, sectionContent } = await readJsonBody(request, updateReportSchema, 550_000);

    // If updating a specific section
    if (sectionId && sectionContent) {
      let sections = JSON.parse(report.sections) as Array<{
        id: string;
        title: string;
        content: string;
        status: string;
        order: number;
      }>;

      const sectionIndex = sections.findIndex((s) => s.id === sectionId);
      if (sectionIndex === -1) {
        return NextResponse.json(
          { error: 'Section non trouvée' },
          { status: 404 }
        );
      }

      // Update section content
      sections[sectionIndex] = {
        ...sections[sectionIndex],
        content: sectionContent,
        status: 'completed',
      };

      // Rebuild full content from sections
      const newFullContent = sections
        .map((s) => `# ${s.title}\n\n${s.content}`)
        .join('\n\n---\n\n');

      const wordCount = newFullContent.split(/\s+/).filter(Boolean).length;

      const updated = await db.report.update({
        where: { id },
        data: {
          sections: JSON.stringify(sections),
          content: newFullContent,
          wordCount,
        },
      });

      return NextResponse.json({ report: updated });
    }

    // If updating full content directly
    if (content !== undefined) {
      const wordCount = content.split(/\s+/).filter(Boolean).length;

      const updated = await db.report.update({
        where: { id },
        data: {
          content,
          wordCount,
        },
      });

      return NextResponse.json({ report: updated });
    }

    // No valid update fields provided
    return NextResponse.json(
      { error: 'Aucune donnée à mettre à jour. Spécifiez content, sectionId et/ou sectionContent.' },
      { status: 400 }
    );
  } catch (error) {
    console.error('PATCH /api/reports/[id] error:', error);
    const requestError = apiRequestErrorResponse(error);
    if (requestError) return requestError;
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du rapport' },
      { status: 500 }
    );
  }
}
