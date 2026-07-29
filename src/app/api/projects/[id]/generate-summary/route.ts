import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { generateFrenchSummary } from '@/lib/types';

export const runtime = 'nodejs';

// POST /api/projects/[id]/generate-summary - Generate a RAG summary
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const project = await db.project.findUnique({
      where: { id },
      include: { documents: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Projet non trouvé' },
        { status: 404 }
      );
    }

    if (project.documents.length === 0) {
      return NextResponse.json(
        { error: 'Ajoutez au moins un document avant de générer une synthèse' },
        { status: 400 }
      );
    }

    // Update project status to SUMMARIZING
    await db.project.update({
      where: { id },
      data: { status: 'SUMMARIZING' },
    });

    // Create generation job
    const jobId = uuidv4();
    const job = await db.generationJob.create({
      data: {
        id: jobId,
        userId: project.userId,
        projectId: id,
        type: 'summary',
        status: 'PENDING',
        progress: 0,
        progressMessage: 'Initialisation de la génération...',
      },
    });

    // Simulate async summary generation
    setTimeout(async () => {
      try {
        // Update job to processing
        await db.generationJob.update({
          where: { id: jobId },
          data: {
            status: 'PROCESSING',
            progress: 20,
            progressMessage: 'Analyse des documents en cours...',
            startedAt: new Date(),
          },
        });

        await new Promise((r) => setTimeout(r, 1500));

        await db.generationJob.update({
          where: { id: jobId },
          data: {
            progress: 50,
            progressMessage: 'Extraction des concepts clés...',
          },
        });

        await new Promise((r) => setTimeout(r, 1500));

        await db.generationJob.update({
          where: { id: jobId },
          data: {
            progress: 75,
            progressMessage: 'Synthèse bibliographique en cours...',
          },
        });

        await new Promise((r) => setTimeout(r, 1000));

        // Generate the summary content
        const topic = project.title;
        const summaryContent = generateFrenchSummary(topic);

        // Get latest version number
        const existingSummaries = await db.summary.findMany({
          where: { projectId: id },
          orderBy: { version: 'desc' },
          take: 1,
        });

        const nextVersion = (existingSummaries[0]?.version ?? 0) + 1;

        // Create the summary
        const summary = await db.summary.create({
          data: {
            id: uuidv4(),
            projectId: id,
            version: nextVersion,
            content: summaryContent,
            structure: JSON.stringify({
              title: topic,
              keyPoints: [
                'Approche méthodologique rigoureuse',
                'Revue systématique de la littérature',
                'Identification des lacunes de la recherche',
              ],
              methodology: 'RAG (Retrieval Augmented Generation)',
              findings: [
                'Convergence des approches modernes',
                'Amélioration significative des performances',
                'Besoin d\'outils standardisés',
              ],
              gaps: [
                'Documentation insuffisante sur la migration',
                'Manque de métriques normalisées',
                'Complexité d\'intégration sous-estimée',
              ],
            }),
            status: 'SUMMARY_READY',
          },
        });

        // Complete the job
        await db.generationJob.update({
          where: { id: jobId },
          data: {
            status: 'COMPLETED',
            progress: 100,
            progressMessage: 'Synthèse générée avec succès',
            outputData: JSON.stringify({ summaryId: summary.id }),
            completedAt: new Date(),
          },
        });

        // Update project status
        await db.project.update({
          where: { id },
          data: { status: 'SUMMARY_READY' },
        });

        // Record API usage
        await db.apiUsage.create({
          data: {
            userId: project.userId,
            projectId: id,
            type: 'summary_generation',
            inputTokens: 12000 + Math.floor(Math.random() * 3000),
            outputTokens: 3000 + Math.floor(Math.random() * 1000),
            costUsd: 0.05 + Math.random() * 0.05,
          },
        });

        // Increment credits used
        await db.user.update({
          where: { id: project.userId },
          data: { creditsUsed: { increment: 1 } },
        });
      } catch (err) {
        console.error('Summary generation error:', err);
        await db.generationJob.update({
          where: { id: jobId },
          data: {
            status: 'FAILED',
            progressMessage: 'Erreur lors de la génération',
            errorMessage: 'Échec de la génération de la synthèse',
            completedAt: new Date(),
          },
        });

        await db.project.update({
          where: { id },
          data: { status: 'DRAFT' },
        });
      }
    }, 500);

    return NextResponse.json({
      jobId: job.id,
      status: 'PENDING',
      message: 'Génération de la synthèse lancée',
    });
  } catch (error) {
    console.error('POST /api/projects/[id]/generate-summary error:', error);
    return NextResponse.json(
      { error: 'Erreur lors du lancement de la génération' },
      { status: 500 }
    );
  }
}
