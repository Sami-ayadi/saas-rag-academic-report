import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

import { db } from '@/lib/db'
import { createNotification } from '@/lib/notifications'
import { getAuthenticatedUser } from '@/lib/auth'
import { generateSummaryForProject } from '@/lib/report-generation'
import { resolveEntitlements } from '@/lib/entitlements'
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
        type: 'summary',
        status: 'PROCESSING',
        progress: 20,
        progressMessage: 'Génération de la synthèse en cours…',
        startedAt: new Date(),
      },
    })
    await db.project.update({ where: { id }, data: { status: 'SUMMARIZING' } })
  } catch (error) {
    await refundQuota(user.id, 'generation', period)
    console.error('POST /api/projects/[id]/generate-summary setup error:', error)
    return NextResponse.json({ error: 'La génération de la synthèse a échoué' }, { status: 500 })
  }

  try {
    const generated = await generateSummaryForProject({
      title: project.title,
      brief: project.brief,
      academicLevel: project.academicLevel,
      university: project.university,
      field: project.field,
      language: project.language,
      sourceNames: project.documents.map((document) => document.originalName),
      sourceExcerpts: sourceChunks.map((chunk) => chunk.content),
      structuredBrief: project.briefs[0]?.content,
    })

    const latest = await db.summary.findFirst({
      where: { projectId: id },
      orderBy: { version: 'desc' },
      select: { version: true },
    })
    const summary = await db.summary.create({
      data: {
        id: uuidv4(),
        projectId: id,
        version: (latest?.version ?? 0) + 1,
        content: generated.content,
        structure: JSON.stringify({
          title: project.title,
          provider: generated.provider,
          model: generated.model,
          sourceNames: project.documents.map((document) => document.originalName),
        }),
        status: 'SUMMARY_READY',
      },
    })

    await db.$transaction([
      db.generationJob.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          progress: 100,
          progressMessage: 'Synthèse générée avec succès',
          outputData: JSON.stringify({ summaryId: summary.id, provider: generated.provider, model: generated.model }),
          completedAt: new Date(),
        },
      }),
      db.project.update({ where: { id }, data: { status: 'SUMMARY_READY' } }),
      db.apiUsage.create({
        data: {
          userId: user.id,
          projectId: id,
          type: 'summary_generation',
          inputTokens: generated.inputTokens,
          outputTokens: generated.outputTokens,
          costUsd: 0,
        },
      }),
    ])
    await createNotification({ userId: user.id, type: 'GENERATION_COMPLETED', title: 'Synthèse prête', message: `La synthèse de « ${project.title} » est disponible.`, linkView: 'dashboard', metadata: { projectId: id, summaryId: summary.id } })

    return NextResponse.json({
      jobId: job.id,
      summaryId: summary.id,
      status: 'COMPLETED',
      provider: generated.provider,
      model: generated.model,
      message: generated.provider !== 'demo'
        ? 'Synthèse générée par IA'
        : 'Synthèse de démonstration générée localement',
    })
  } catch (error) {
    console.error('POST /api/projects/[id]/generate-summary error:', error)
    // Refund policy: a generation that stored no artefact returns its credit.
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
      db.project.update({ where: { id }, data: { status: 'DRAFT' } }),
    ])
    await createNotification({ userId: user.id, type: 'GENERATION_FAILED', title: 'Échec de la synthèse', message: `La synthèse de « ${project.title} » n'a pas pu être générée.`, linkView: 'dashboard', metadata: { projectId: id, jobId: job.id } })
    return NextResponse.json({ error: 'La génération de la synthèse a échoué' }, { status: 502 })
  }
}
