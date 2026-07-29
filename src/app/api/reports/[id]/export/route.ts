import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod/v4';

export const runtime = 'nodejs';

const exportSchema = z.object({
  format: z.enum(['docx', 'pdf']),
});

// POST /api/reports/[id]/export - Export report in specified format
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const report = await db.report.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!report) {
      return NextResponse.json(
        { error: 'Rapport non trouvé' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { format } = exportSchema.parse(body);

    // Update project status to EXPORTED
    await db.project.update({
      where: { id: report.projectId },
      data: { status: 'EXPORTED' },
    });

    // In a real app, we would use a library like docx or puppeteer to generate the file
    // For demo, return a structured JSON response
    const exportResult = {
      downloadUrl: `/api/reports/${id}/download?format=${format}`,
      format,
      filename: `${report.title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}.${format}`,
      generatedAt: new Date().toISOString(),
      size: format === 'pdf' ? report.wordCount * 150 : report.wordCount * 200, // estimated size in bytes
      metadata: {
        title: report.title,
        author: 'RapportGen AI',
        wordCount: report.wordCount,
        sectionCount: JSON.parse(report.sections).length,
        projectTitle: report.project.title,
        university: report.project.university,
        academicLevel: report.project.academicLevel,
        field: report.project.field,
      },
      message: format === 'pdf'
        ? 'Le fichier PDF a été préparé. Dans un environnement de production, le téléchargement serait disponible immédiatement.'
        : 'Le fichier DOCX a été préparé. Dans un environnement de production, le téléchargement serait disponible immédiatement.',
    };

    return NextResponse.json({
      export: exportResult,
    });
  } catch (error) {
    console.error('POST /api/reports/[id]/export error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Format invalide. Utilisez "docx" ou "pdf".' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Erreur lors de l\'export du rapport' },
      { status: 500 }
    );
  }
}
