import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { createHash } from 'node:crypto'

import { db } from '@/lib/db'
import { createNotification } from '@/lib/notifications'
import { getAuthenticatedUser } from '@/lib/auth'
import { generateLongReportForProject, isLlmConfigured, parseReportGenerationCheckpoint } from '@/lib/report-generation'
import type { GenerationProject, ReportGenerationCheckpoint } from '@/lib/report-generation'
import { publicLlmFailureMessage } from '@/lib/llm-errors'
import { buildReportOutline, resolveEntitlements } from '@/lib/entitlements'
import { consumeQuota, QuotaExceededError, refundQuota, usagePeriod } from '@/lib/entitlements-server'

export const runtime = 'nodejs'
// PRODUCTION: A request lifetime limit does not protect this detached task.
// Run report generation in a durable queue/worker before serverless deployment.
export const maxDuration = 300

class JobExpiredError extends Error {}

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
  if (!isLlmConfigured()) return NextResponse.json({ error: 'Le service IA n’est pas configuré. Ajoutez LLM_API_KEY au serveur.', code: 'LLM_NOT_CONFIGURED' }, { status: 503 })

  // Consume the credit before any model call so parallel requests cannot exceed the plan.
  const entitlements = resolveEntitlements(user)
  const period = usagePeriod()
  try {
    await consumeQuota(user.id, 'generation', entitlements.monthlyGenerationCredits, period)
  } catch (error) {
    if (!(error instanceof QuotaExceededError)) throw error
    return NextResponse.json(
      {
        error: 'Crédits de génération épuisés pour ce mois.',
        code: 'GENERATION_QUOTA_EXCEEDED',
      },
      { status: 402 },
    )
  }

  let generationContext: GenerationProject
  let summaryContent: string
  let checkpointHash: string
  let resumeCheckpoint: ReportGenerationCheckpoint | undefined
  let job: { id: string }
  const summary = project.summaries[0]
  const targetPages = Math.min(Math.max(Math.trunc(Number(process.env.REPORT_TARGET_PAGES ?? 50)) || 50, 10), 120)
  try {
    const sourceChunks = await db.embedding.findMany({
      where: { projectId: id },
      orderBy: { chunkIndex: 'asc' },
      take: 30,
      select: { content: true },
    })

    generationContext = {
      title: project.title,
      brief: project.brief,
      academicLevel: project.academicLevel,
      university: project.university,
      field: project.field,
      language: project.language,
      sourceNames: project.documents.map((document) => document.originalName),
      sourceExcerpts: sourceChunks.map((chunk) => chunk.content),
      structuredBrief: project.briefs[0]?.content,
    }
    summaryContent = summary?.content ?? project.brief ?? project.title
    checkpointHash = createHash('sha256').update(JSON.stringify({ generationContext, summaryContent, targetPages })).digest('hex')

    const priorJobs = await db.generationJob.findMany({
      where: { userId: user.id, projectId: id, type: 'report', status: 'FAILED', outputData: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { outputData: true },
    })
    for (const prior of priorJobs) {
      try {
        const saved = JSON.parse(prior.outputData ?? '')
        if (saved?.kind !== 'report-checkpoint' || saved.version !== 1 || saved.contextHash !== checkpointHash) continue
        const parsed = parseReportGenerationCheckpoint(saved.checkpoint)
        if (parsed) {
          resumeCheckpoint = parsed
          break
        }
      } catch { /* Ignore older or malformed job output. */ }
    }

    const completed = resumeCheckpoint?.sections.length ?? 0
    const total = resumeCheckpoint?.outline.sections.length ?? 0
    job = await db.generationJob.create({
      data: {
        id: uuidv4(),
        userId: user.id,
        projectId: id,
        type: 'report',
        status: 'PROCESSING',
        progress: completed && total ? Math.min(95, 15 + Math.round((completed / total) * 80)) : 10,
        progressMessage: completed ? `Reprise du rapport à la section ${completed + 1}/${total}…` : 'Planification du rapport en cours…',
        outputData: resumeCheckpoint ? JSON.stringify({ kind: 'report-checkpoint', version: 1, contextHash: checkpointHash, checkpoint: resumeCheckpoint }) : null,
        startedAt: new Date(),
      },
    })
    await db.project.update({ where: { id }, data: { status: 'GENERATING' } })
  } catch (error) {
    await refundQuota(user.id, 'generation', period)
    console.error('POST /api/projects/[id]/generate-report setup error:', error)
    return NextResponse.json({ error: 'La génération du rapport a échoué', code: 'GENERATION_SETUP_FAILED' }, { status: 500 })
  }

  // The ~50-page pipeline issues 14-22 LLM calls and takes tens of minutes:
  // answer immediately with the job id and keep generating in the background
  // so the client can follow live progress through GET /api/jobs/[id].
  void (async () => {
    try {
      const generated = await generateLongReportForProject(
        generationContext,
        summaryContent,
        targetPages,
        undefined,
        { checkpoint: resumeCheckpoint, onCheckpoint: async (checkpoint) => {
          const current = checkpoint.sections.length
          const total = checkpoint.outline.sections.length
          const words = checkpoint.sections.reduce((sum, section) => sum + section.content.split(/\s+/).filter(Boolean).length, 0)
          const updated = await db.generationJob.updateMany({
            where: { id: job.id, status: 'PROCESSING' },
            data: {
              progress: current ? Math.min(95, 15 + Math.round((current / total) * 80)) : 10,
              progressMessage: current
                ? `Rédaction (${current}/${total}) : ${checkpoint.sections.at(-1)?.title} — ${words.toLocaleString('fr-FR')} mots écrits`
                : 'Plan du rapport enregistré. Rédaction en cours…',
              outputData: JSON.stringify({ kind: 'report-checkpoint', version: 1, contextHash: checkpointHash, checkpoint }),
            },
          })
          if (updated.count !== 1) throw new JobExpiredError('Generation job is no longer active')
        } },
      )

      const fullContent = generated.content
        .map((section) => `# ${section.title}\n\n${section.content}`)
        .join('\n\n---\n\n')
      const wordCount = fullContent.split(/\s+/).filter(Boolean).length
      const estimatedPages = Math.max(1, Math.round(wordCount / 280))

      const reportId = uuidv4()
      const report = await db.$transaction(async (transaction) => {
        const claimed = await transaction.generationJob.updateMany({
          where: { id: job.id, status: 'PROCESSING' },
          data: {
            status: 'COMPLETED',
            progress: 100,
            progressMessage: `Rapport généré : ${generated.content.length} sections, ${wordCount.toLocaleString('fr-FR')} mots (~${estimatedPages} pages)`,
            outputData: JSON.stringify({
              reportId,
              provider: generated.provider,
              model: generated.model,
              sections: generated.content.length,
              wordCount,
              estimatedPages,
              costUsd: generated.costUsd,
            }),
            completedAt: new Date(),
          },
        })
        if (claimed.count !== 1) throw new JobExpiredError('Generation job is no longer active')
        const created = await transaction.report.create({ data: {
          id: reportId,
          projectId: id,
          summaryId: summary?.id,
          title: `Rapport de stage : ${project.title}`,
          content: fullContent,
          sections: JSON.stringify(generated.content),
          // Stored privately; only released to tiers with the tableOfContents entitlement.
          outline: JSON.stringify(buildReportOutline(generated.content)),
          status: 'REPORT_READY',
          wordCount,
        } })
        await transaction.project.update({ where: { id }, data: { status: 'REPORT_READY' } })
        await transaction.apiUsage.create({ data: {
          userId: user.id,
          projectId: id,
          type: 'report_generation',
          inputTokens: generated.inputTokens,
          outputTokens: generated.outputTokens,
          costUsd: generated.costUsd,
        } })
        return created
      })
      await createNotification({
        userId: user.id,
        type: 'GENERATION_COMPLETED',
        title: 'Rapport prêt',
        message: `Le rapport complet de « ${project.title} » (${generated.content.length} sections, ~${estimatedPages} pages) est disponible.`,
        linkView: 'dashboard',
        metadata: { projectId: id, reportId: report.id },
      })
    } catch (error) {
      if (error instanceof JobExpiredError) return
      console.error('POST /api/projects/[id]/generate-report background error:', error)
      try {
        const claimed = await db.$transaction(async (transaction) => {
          const result = await transaction.generationJob.updateMany({
            where: { id: job.id, status: 'PROCESSING' },
            data: {
              status: 'FAILED',
              progressMessage: publicLlmFailureMessage(error) ?? 'Échec de la génération',
              errorMessage: error instanceof Error ? error.message.slice(0, 500) : 'Erreur inconnue',
              completedAt: new Date(),
            },
          })
          if (result.count === 1) await transaction.project.update({
            where: { id }, data: { status: project.summaries.length ? 'SUMMARY_READY' : 'DRAFT' },
          })
          return result.count === 1
        })
        if (!claimed) return
        // Only the process that changed PROCESSING -> FAILED refunds the credit.
        await refundQuota(user.id, 'generation', period)
        await createNotification({
          userId: user.id,
          type: 'GENERATION_FAILED',
          title: 'Échec du rapport',
          message: `Le rapport de « ${project.title} » n'a pas pu être généré.`,
          linkView: 'dashboard',
          metadata: { projectId: id, jobId: job.id },
        })
      } catch (cleanupError) {
        console.error('POST /api/projects/[id]/generate-report cleanup error:', cleanupError)
      }
    }
  })()

  return NextResponse.json({
    jobId: job.id,
    status: 'PROCESSING',
    targetPages,
    message: `Génération d'un rapport de ~${targetPages} pages lancée — la progression est visible en direct.`,
  })
}
