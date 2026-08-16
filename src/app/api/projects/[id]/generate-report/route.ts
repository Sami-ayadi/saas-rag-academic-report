import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

import { db } from '@/lib/db'
import { getAuthenticatedUser } from '@/lib/auth'
import { generateReportForProject } from '@/lib/report-generation'

export const runtime = 'nodejs'
export const maxDuration = 180

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const project = await db.project.findFirst({
    where: { id, userId: user.id },
    include: {
      documents: true,
      summaries: { orderBy: { version: 'desc' }, take: 1 },
      briefs: { orderBy: { version: 'desc' }, take: 1 },
    },
  })
  if (!project) return NextResponse.json({ error: 'Projet non trouvé' }, { status: 404 })

  const sourceChunks = await db.embedding.findMany({
    where: { projectId: id },
    orderBy: { chunkIndex: 'asc' },
    take: 30,
    select: { content: true },
  })

  const job = await db.generationJob.create({
    data: {
      id: uuidv4(),
      userId: user.id,
      projectId: id,
      type: 'report',
      status: 'PROCESSING',
      progress: 15,
      progressMessage: 'Génération du rapport en cours…',
      startedAt: new Date(),
    },
  })
  await db.project.update({ where: { id }, data: { status: 'GENERATING' } })

  try {
    const summary = project.summaries[0]
    const generated = await generateReportForProject(
      {
        title: project.title,
        brief: project.brief,
        academicLevel: project.academicLevel,
        university: project.university,
        field: project.field,
        language: project.language,
        sourceNames: project.documents.map((document) => document.originalName),
        sourceExcerpts: sourceChunks.map((chunk) => chunk.content),
        structuredBrief: project.briefs[0]?.content,
      },
      summary?.content ?? project.brief ?? project.title,
    )
    const fullContent = generated.content
      .map((section) => `# ${section.title}\n\n${section.content}`)
      .join('\n\n---\n\n')
    const wordCount = fullContent.split(/\s+/).filter(Boolean).length

    const report = await db.report.create({
      data: {
        id: uuidv4(),
        projectId: id,
        summaryId: summary?.id,
        title: `Rapport de stage : ${project.title}`,
        content: fullContent,
        sections: JSON.stringify(generated.content),
        status: 'REPORT_READY',
        wordCount,
      },
    })

    await db.$transaction([
      db.generationJob.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          progress: 100,
          progressMessage: 'Rapport généré avec succès',
          outputData: JSON.stringify({ reportId: report.id, provider: generated.provider, model: generated.model }),
          completedAt: new Date(),
        },
      }),
      db.project.update({ where: { id }, data: { status: 'REPORT_READY' } }),
      db.apiUsage.create({
        data: {
          userId: user.id,
          projectId: id,
          type: 'report_generation',
          inputTokens: generated.inputTokens,
          outputTokens: generated.outputTokens,
          costUsd: 0,
        },
      }),
      db.user.update({ where: { id: user.id }, data: { creditsUsed: { increment: 1 } } }),
    ])

    return NextResponse.json({
      jobId: job.id,
      reportId: report.id,
      status: 'COMPLETED',
      provider: generated.provider,
      model: generated.model,
      message: generated.provider === 'openai'
        ? 'Rapport généré par IA'
        : 'Rapport de démonstration généré localement',
    })
  } catch (error) {
    console.error('POST /api/projects/[id]/generate-report error:', error)
    await db.$transaction([
      db.generationJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          progressMessage: 'Échec de la génération',
          errorMessage: error instanceof Error ? error.message.slice(0, 500) : 'Erreur inconnue',
          completedAt: new Date(),
        },
      }),
      db.project.update({
        where: { id },
        data: { status: project.summaries.length ? 'SUMMARY_READY' : 'DRAFT' },
      }),
    ])
    return NextResponse.json({ error: 'La génération du rapport a échoué' }, { status: 502 })
  }
}
