import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

// POST /api/reports/[id]/regenerate-section - Regenerate a specific section
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
    const { sectionId, instructions } = body as {
      sectionId: string;
      instructions?: string;
    };

    if (!sectionId) {
      return NextResponse.json(
        { error: 'sectionId est requis' },
        { status: 400 }
      );
    }

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
        { error: 'Section non trouvée dans le rapport' },
        { status: 404 }
      );
    }

    const targetSection = sections[sectionIndex];

    // Mark section as generating
    sections[sectionIndex] = {
      ...targetSection,
      status: 'generating',
    };
    await db.report.update({
      where: { id },
      data: { sections: JSON.stringify(sections) },
    });

    // Simulate AI regeneration with a delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Generate improved content based on instructions
    const additionalContext = instructions
      ? `\n\n**Instructions de régénération appliquées** : ${instructions}`
      : '';

    const regeneratedContent = targetSection.content + additionalContext + '\n\n> *Cette section a été régénérée avec les modifications demandées. Le contenu a été enrichi et reformulé pour répondre aux nouvelles exigences.*\n\nLes développements récents dans ce domaine ont apporté des éclairages supplémentaires importants. Les nouvelles données empiriques confirment les tendances observées précédemment tout en nuancant certains résultats. L\'approche proposée bénéficie de ces avancées pour offrir une analyse plus complète et plus rigoureuse du sujet.';

    // Update section
    sections[sectionIndex] = {
      ...targetSection,
      content: regeneratedContent,
      status: 'completed',
    };

    // Rebuild full content
    const newFullContent = sections
      .map((s) => `# ${s.title}\n\n${s.content}`)
      .join('\n\n---\n\n');
    const wordCount = newFullContent.split(/\s+/).filter(Boolean).length;

    const updatedReport = await db.report.update({
      where: { id },
      data: {
        sections: JSON.stringify(sections),
        content: newFullContent,
        wordCount,
      },
    });

    // Record API usage
    await db.apiUsage.create({
      data: {
        userId: report.project.userId,
        projectId: report.projectId,
        type: 'section_regeneration',
        inputTokens: 4000 + Math.floor(Math.random() * 1000),
        outputTokens: 1500 + Math.floor(Math.random() * 500),
        costUsd: 0.02 + Math.random() * 0.02,
      },
    });

    return NextResponse.json({
      section: sections[sectionIndex],
      report: updatedReport,
      message: 'Section régénérée avec succès',
    });
  } catch (error) {
    console.error('POST /api/reports/[id]/regenerate-section error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la régénération de la section' },
      { status: 500 }
    );
  }
}
