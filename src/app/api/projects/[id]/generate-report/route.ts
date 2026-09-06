import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

import { db } from '@/lib/db'
import { createNotification } from '@/lib/notifications'
import { getAuthenticatedUser } from '@/lib/auth'
import { generateReportForProject } from '@/lib/report-generation'
import { buildReportOutline, resolveEntitlements } from '@/lib/entitlements'
import { consumeQuota, refundQuota, usagePeriod } from '@/lib/entitlements-server'

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

  // Consume the credit before any model call so parallel requests cannot exceed the plan.
  const entitlements = resolveEntitlements(user)
  const period = usagePeriod()
  const quota = await consumeQuota(user.id, 'generation', entitlements.monthlyGenerationCredits, period)
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: `Crédits de génération épuisés (${quota.used}/${quota.limit} ce mois-ci).`,
        code: 'GENERATION_QUOTA_EXCEEDED',
        quota: { used: quota.used, limit: quota.limit, remaining: 0 },
      },
      { status: 402 },
    )
  }

  let sourceChunks: Array<{ content: string }>
  let job: { id: string }
  try {
    sourceChunks = await db.embedding.findMany({
      where: { projectId: id },
      orderBy: { chunkIndex: 'asc' },
      take: 30,
      select: { content: true },
    })

    job = await db.generationJob.create({
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
  } catch (error) {
    await refundQuota(user.id, 'generation', period)
    console.error('POST /api/projects/[id]/generate-report setup error:', error)
    return NextResponse.json({ error: 'La génération du rapport a échoué' }, { status: 500 })
  }

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
        // Stored privately; only released to tiers with the tableOfContents entitlement.
        outline: JSON.stringify(buildReportOutline(generated.content)),
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
    ])
    await createNotification({ userId: user.id, type: 'GENERATION_COMPLETED', title: 'Rapport prêt', message: `Le rapport de « ${project.title} » est disponible.`, linkView: 'dashboard', metadata: { projectId: id, reportId: report.id } })

    return NextResponse.json({
      jobId: job.id,
      reportId: report.id,
      status: 'COMPLETED',
      provider: generated.provider,
      model: generated.model,
      message: generated.provider !== 'demo'
        ? 'Rapport généré par IA'
        : 'Rapport de démonstration généré localement',
    })
  } catch (error) {
    console.error('POST /api/projects/[id]/generate-report error:', error)
    // Refund policy: a generation that stored no report returns its credit.
    await refundQuota(user.id, 'generation', period)
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
    await createNotification({ userId: user.id, type: 'GENERATION_FAILED', title: 'Échec du rapport', message: `Le rapport de « ${project.title} » n'a pas pu être généré.`, linkView: 'dashboard', metadata: { projectId: id, jobId: job.id } })
    return NextResponse.json({ error: 'La génération du rapport a échoué' }, { status: 502 })
  }
}
