import { createHash, randomUUID } from 'node:crypto'

import type { GenerationJob, Prisma } from '@prisma/client'

import { db } from '@/lib/db'
import { releaseQuotaReservation } from '@/lib/entitlements-server'
import { LlmHttpError, publicLlmFailureMessage } from '@/lib/llm-errors'
import { createNotification } from '@/lib/notifications'
import {
  generateLongReportForProject,
  parseReportGenerationCheckpoint,
  parseReportOutline,
  type GenerationProject,
  type ReportGenerationCheckpoint,
} from '@/lib/report-generation'
import { assessReportQuality } from '@/lib/report-quality'
import { retrieveRelevantSourceChunks, sourceChunksForPrompt } from '@/lib/source-retrieval'

const LEASE_MS = 10 * 60_000

interface ReportJobPayload {
  kind: 'report-job'
  version: 2
  operationKey: string
  planId: string
  checkpoint?: ReportGenerationCheckpoint
}

function parsePayload(value: string | null): ReportJobPayload | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as Partial<ReportJobPayload>
    if (parsed.kind !== 'report-job' || parsed.version !== 2 || typeof parsed.operationKey !== 'string' || typeof parsed.planId !== 'string') return null
    const checkpoint = parsed.checkpoint ? parseReportGenerationCheckpoint(parsed.checkpoint) : undefined
    return { kind: 'report-job', version: 2, operationKey: parsed.operationKey, planId: parsed.planId, checkpoint: checkpoint ?? undefined }
  } catch {
    return null
  }
}

function stringifyPayload(payload: ReportJobPayload) {
  return JSON.stringify(payload)
}

function retryDelay(attempt: number) {
  return Math.min(30 * 60_000, 30_000 * 2 ** Math.max(0, attempt - 1))
}

async function claimNextJob(workerId: string): Promise<GenerationJob | null> {
  for (let tries = 0; tries < 5; tries++) {
    const now = new Date()
    const candidate = await db.generationJob.findFirst({
      where: {
        type: 'report',
        OR: [
          { status: 'PENDING' },
          { status: 'RETRY_WAIT', nextAttemptAt: { lte: now } },
          { status: 'PROCESSING', leaseExpiresAt: { lt: now } },
        ],
      },
      orderBy: { createdAt: 'asc' },
    })
    if (!candidate) return null
    const claimed = await db.generationJob.updateMany({
      where: {
        id: candidate.id,
        OR: [
          { status: 'PENDING' },
          { status: 'RETRY_WAIT', nextAttemptAt: { lte: now } },
          { status: 'PROCESSING', leaseExpiresAt: { lt: now } },
        ],
      },
      data: {
        status: 'PROCESSING',
        lockedBy: workerId,
        leaseExpiresAt: new Date(now.getTime() + LEASE_MS),
        heartbeatAt: now,
        startedAt: candidate.startedAt ?? now,
        nextAttemptAt: null,
        attempt: { increment: 1 },
        progressMessage: candidate.progress > 0 ? 'Reprise de la rédaction enregistrée…' : 'Préparation de la rédaction…',
      },
    })
    if (claimed.count === 1) return db.generationJob.findUnique({ where: { id: candidate.id } })
  }
  return null
}

async function finishFailure(job: GenerationJob, payload: ReportJobPayload, error: unknown) {
  const retryable = error instanceof LlmHttpError ? error.status === 408 || error.status === 429 || error.status >= 500 : false
  const hasCheckpoint = Boolean(payload.checkpoint?.sections.length)
  const publicMessage = publicLlmFailureMessage(error, hasCheckpoint) ?? 'La génération a échoué pendant la rédaction.'
  if (retryable && job.attempt < job.maxAttempts) {
    const waitMs = retryDelay(job.attempt)
    await db.generationJob.updateMany({
      where: { id: job.id, status: 'PROCESSING', lockedBy: job.lockedBy },
      data: {
        status: 'RETRY_WAIT',
        lockedBy: null,
        leaseExpiresAt: null,
        nextAttemptAt: new Date(Date.now() + waitMs),
        progressMessage: `${publicMessage} Reprise automatique programmée.`,
        errorMessage: error instanceof Error ? error.message.slice(0, 1_000) : 'Unknown report worker error',
        outputData: stringifyPayload(payload),
      },
    })
    return
  }

  await releaseQuotaReservation(payload.operationKey)
  await db.$transaction(async (transaction) => {
    await transaction.generationJob.updateMany({
      where: { id: job.id, status: 'PROCESSING', lockedBy: job.lockedBy },
      data: {
        status: 'FAILED',
        lockedBy: null,
        leaseExpiresAt: null,
        progressMessage: publicMessage,
        errorMessage: error instanceof Error ? error.message.slice(0, 1_000) : 'Unknown report worker error',
        outputData: stringifyPayload(payload),
        completedAt: new Date(),
      },
    })
    await transaction.project.updateMany({
      where: { id: job.projectId, status: 'DRAFTING' },
      data: { status: 'OUTLINE_APPROVED' },
    })
  })
  await createNotification({
    userId: job.userId,
    type: 'REPORT_FAILED',
    title: 'Rédaction interrompue',
    message: publicMessage,
    linkView: 'project-detail',
    metadata: { projectId: job.projectId, jobId: job.id },
  }).catch(() => undefined)
}

async function processClaimedJob(job: GenerationJob) {
  const payload = parsePayload(job.outputData)
  if (!payload) {
    await db.generationJob.update({
      where: { id: job.id },
      data: { status: 'FAILED', errorMessage: 'Invalid durable job payload', progressMessage: 'Travail de génération invalide.', completedAt: new Date() },
    })
    return
  }
  try {
    const project = await db.project.findUnique({
      where: { id: job.projectId },
      include: {
        documents: { where: { role: 'PROJECT_EVIDENCE', status: 'processed' } },
        summaries: { orderBy: { version: 'desc' }, take: 1 },
        briefs: { where: { status: 'APPROVED' }, orderBy: { version: 'desc' }, take: 1 },
      },
    })
    const plan = await db.reportPlan.findFirst({ where: { id: payload.planId, projectId: job.projectId, status: 'APPROVED' } })
    const outline = plan ? parseReportOutline(plan.content) : null
    const brief = project?.briefs[0]
    if (!project || !plan || !outline || !brief) throw new Error('Le brief ou le plan approuvé n’est plus disponible.')

    const broadSources = await retrieveRelevantSourceChunks(project.id, `${project.title}\n${project.brief ?? ''}`, 20)
    const generationContext: GenerationProject = {
      title: project.title,
      brief: project.brief,
      academicLevel: project.academicLevel,
      university: project.university,
      field: project.field,
      language: project.language,
      sourceNames: project.documents.map((document) => document.originalName),
      sourceExcerpts: sourceChunksForPrompt(broadSources),
      structuredBrief: brief.content,
      reportTemplate: plan.templateKey === 'security-audit-v1' ? 'security-audit-v1' : 'software-classic-v1',
    }
    const summary = project.summaries[0]?.content ?? JSON.stringify(brief.content)
    const generated = await generateLongReportForProject(generationContext, summary, outline.totalEstimatedPages, undefined, {
      checkpoint: payload.checkpoint,
      outline,
      sourceResolver: async (section) => {
        const chunks = await retrieveRelevantSourceChunks(
          project.id,
          `${section.title}\n${section.keyPoints.join('\n')}\n${JSON.stringify(brief.content)}`,
          18,
        )
        return sourceChunksForPrompt(chunks)
      },
      onCheckpoint: async (checkpoint) => {
        payload.checkpoint = checkpoint
        const current = checkpoint.sections.length
        const total = checkpoint.outline.sections.length
        const words = checkpoint.sections.reduce((sum, section) => sum + section.content.split(/\s+/).filter(Boolean).length, 0)
        const updated = await db.generationJob.updateMany({
          where: { id: job.id, status: 'PROCESSING', lockedBy: job.lockedBy },
          data: {
            progress: current ? Math.min(95, 10 + Math.round((current / total) * 85)) : 10,
            progressMessage: current
              ? `Rédaction ${current}/${total} — ${words.toLocaleString('fr-FR')} mots enregistrés`
              : 'Plan approuvé chargé. Rédaction en cours…',
            outputData: stringifyPayload(payload),
            heartbeatAt: new Date(),
            leaseExpiresAt: new Date(Date.now() + LEASE_MS),
          },
        })
        if (updated.count !== 1) throw new Error('Le bail du worker a expiré.')
      },
    })

    const fullContent = generated.content.map((section) => `# ${section.title}\n\n${section.content}`).join('\n\n---\n\n')
    const wordCount = fullContent.split(/\s+/).filter(Boolean).length
    const issues = assessReportQuality(generated.content)
    const reportId = randomUUID()
    const summaryId = project.summaries[0]?.id ?? null
    const contextHash = createHash('sha256').update(JSON.stringify({ briefId: brief.id, planId: plan.id, documents: project.documents.map((document) => document.contentHash) })).digest('hex')

    await db.$transaction(async (transaction) => {
      const claimed = await transaction.generationJob.updateMany({
        where: { id: job.id, status: 'PROCESSING', lockedBy: job.lockedBy },
        data: {
          status: 'COMPLETED',
          progress: 100,
          progressMessage: issues.some((issue) => issue.severity === 'blocking')
            ? `Brouillon terminé : ${issues.filter((issue) => issue.severity === 'blocking').length} point(s) à corriger avant validation.`
            : 'Brouillon terminé. Relecture et validation requises.',
          outputData: JSON.stringify({ kind: 'report-result', version: 2, reportId, planId: plan.id, wordCount, costUsd: generated.costUsd }),
          contextHash,
          lockedBy: null,
          leaseExpiresAt: null,
          completedAt: new Date(),
        },
      })
      if (claimed.count !== 1) throw new Error('Le travail ne peut plus être finalisé par ce worker.')
      await transaction.report.create({
        data: {
          id: reportId,
          projectId: project.id,
          summaryId,
          planId: plan.id,
          title: `Rapport de stage : ${project.title}`,
          content: fullContent,
          sections: JSON.stringify(generated.content),
          outline: JSON.stringify(outline),
          status: 'REVIEW_REQUIRED',
          qualityIssues: issues as unknown as Prisma.InputJsonValue,
          wordCount,
        },
      })
      await transaction.project.update({ where: { id: project.id }, data: { status: 'REVIEW_REQUIRED' } })
      await transaction.apiUsage.create({
        data: {
          userId: job.userId,
          projectId: project.id,
          type: 'report',
          inputTokens: generated.inputTokens,
          outputTokens: generated.outputTokens,
          costUsd: generated.costUsd,
        },
      })
      const consumed = await transaction.quotaReservation.updateMany({
        where: { operationKey: payload.operationKey, status: 'RESERVED' },
        data: { status: 'CONSUMED' },
      })
      if (consumed.count !== 1) throw new Error('La réservation de quota est absente ou déjà finalisée.')
    })
    await createNotification({
      userId: job.userId,
      type: 'REPORT_REVIEW_REQUIRED',
      title: 'Brouillon prêt à relire',
      message: 'La rédaction est terminée. Vérifiez les preuves et les points signalés avant de valider le rapport.',
      linkView: 'report-editor',
      metadata: { projectId: project.id, reportId },
    }).catch(() => undefined)
  } catch (error) {
    console.error(`[report-worker] job ${job.id} failed:`, error)
    await finishFailure(job, payload, error)
  }
}

export async function processNextReportJob(workerId = `report-worker-${process.pid}-${randomUUID()}`) {
  const job = await claimNextJob(workerId)
  if (!job) return false
  await processClaimedJob(job)
  return true
}
