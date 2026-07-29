import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { generateFrenchReportSections } from '@/lib/types';

export const runtime = 'nodejs';

// POST /api/projects/[id]/generate-report - Generate a report from summary
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const project = await db.project.findUnique({
      where: { id },
      include: {
        documents: true,
        summaries: {
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Projet non trouvé' },
        { status: 404 }
      );
    }

    if (!project.summaries.length) {
      return NextResponse.json(
        { error: 'Générez d\'abord une synthèse avant de créer un rapport' },
        { status: 400 }
      );
    }

    const summary = project.summaries[0];

    // Update project status
    await db.project.update({
      where: { id },
      data: { status: 'GENERATING' },
    });

    // Create generation job
    const jobId = uuidv4();
    const reportId = uuidv4();

    const job = await db.generationJob.create({
      data: {
        id: jobId,
        userId: project.userId,
        projectId: id,
        type: 'report',
        status: 'PENDING',
        progress: 0,
        progressMessage: 'Initialisation de la génération du rapport...',
      },
    });

    // Pre-create the report in draft state
    const report = await db.report.create({
      data: {
        id: reportId,
        projectId: id,
        summaryId: summary.id,
        title: `Rapport de Stage : ${project.title}`,
        content: '',
        sections: '[]',
        status: 'DRAFT',
        wordCount: 0,
      },
    });

    // Simulate async report generation (section by section)
    setTimeout(async () => {
      try {
        await db.generationJob.update({
          where: { id: jobId },
          data: {
            status: 'PROCESSING',
            progress: 10,
            progressMessage: 'Génération de l\'introduction...',
            startedAt: new Date(),
          },
        });

        const topic = project.title;
        const sections = generateFrenchReportSections(topic);

        // Generate sections one by one with delays
        for (let i = 0; i < sections.length; i++) {
          await new Promise((r) => setTimeout(r, 1200));

          const progress = 10 + Math.floor(((i + 1) / sections.length) * 80);
          const sectionName = sections[i].title;

          await db.generationJob.update({
            where: { id: jobId },
            data: {
              progress,
              progressMessage: `Génération : ${sectionName}...`,
            },
          });
        }

        await new Promise((r) => setTimeout(r, 800));

        // Build full content from sections
        const fullContent = sections.map((s) => `# ${s.title}\n\n${s.content}`).join('\n\n---\n\n');
        const wordCount = fullContent.split(/\s+/).filter(Boolean).length;

        // Update report with full content
        await db.report.update({
          where: { id: reportId },
          data: {
            content: fullContent,
            sections: JSON.stringify(sections),
            status: 'REPORT_READY',
            wordCount,
          },
        });

        // Complete the job
        await db.generationJob.update({
          where: { id: jobId },
          data: {
            status: 'COMPLETED',
            progress: 100,
            progressMessage: 'Rapport généré avec succès',
            outputData: JSON.stringify({ reportId }),
            completedAt: new Date(),
          },
        });

        // Update project status
        await db.project.update({
          where: { id },
          data: { status: 'REPORT_READY' },
        });

        // Record API usage
        await db.apiUsage.create({
          data: {
            userId: project.userId,
            projectId: id,
            type: 'report_generation',
            inputTokens: 25000 + Math.floor(Math.random() * 5000),
            outputTokens: 8000 + Math.floor(Math.random() * 2000),
            costUsd: 0.15 + Math.random() * 0.1,
          },
        });

        // Increment credits used
        await db.user.update({
          where: { id: project.userId },
          data: { creditsUsed: { increment: 1 } },
        });
      } catch (err) {
        console.error('Report generation error:', err);
        await db.generationJob.update({
          where: { id: jobId },
          data: {
            status: 'FAILED',
            progressMessage: 'Erreur lors de la génération',
            errorMessage: 'Échec de la génération du rapport',
            completedAt: new Date(),
          },
        });

        await db.project.update({
          where: { id },
          data: { status: 'SUMMARY_READY' },
        });

        await db.report.update({
          where: { id: reportId },
          data: { status: 'DRAFT' },
        });
      }
    }, 500);

    return NextResponse.json({
      jobId: job.id,
      reportId: report.id,
      status: 'PENDING',
      message: 'Génération du rapport lancée',
    });
  } catch (error) {
    console.error('POST /api/projects/[id]/generate-report error:', error);
    return NextResponse.json(
      { error: 'Erreur lors du lancement de la génération' },
      { status: 500 }
    );
  }
}
