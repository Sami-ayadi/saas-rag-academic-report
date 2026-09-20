import { createHash, randomUUID } from 'node:crypto'

import { NextRequest, NextResponse } from 'next/server'

import { getAuthenticatedUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { isSerializationFailure, QuotaExceededError, releaseQuotaReservation, reserveQuotaForOperation, usagePeriod } from '@/lib/entitlements-server'
import { resolveEntitlements } from '@/lib/entitlements'
import { isLlmConfigured, parseReportOutline } from '@/lib/report-generation'

export const runtime = 'nodejs'

function requestKey(request: NextRequest) {
  const value = request.headers.get('idempotency-key')?.trim()
  return value && /^[a-zA-Z0-9:_-]{8,100}$/.test(value) ? value : randomUUID()
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!isLlmConfigured()) {
    return NextResponse.json({ error: 'Le service IA n’est pas configuré.', code: 'LLM_NOT_CONFIGURED' }, { status: 503 })
  }

  const project = await db.project.findFirst({
    where: { id, userId: user.id },
    include: {
      documents: { where: { role: 'PROJECT_EVIDENCE' }, select: { id: true, contentHash: true, status: true } },
      briefs: { where: { status: 'APPROVED' }, orderBy: { version: 'desc' }, take: 1 },
      reportPlans: { where: { status: 'APPROVED' }, orderBy: { version: 'desc' }, take: 1 },
    },
  })
  if (!project) return NextResponse.json({ error: 'Projet non trouvé' }, { status: 404 })
  const brief = project.briefs[0]
  if (!brief) {
    return NextResponse.json({ error: 'Validez le questionnaire avant la rédaction.', code: 'APPROVED_BRIEF_REQUIRED' }, { status: 409 })
  }
  const plan = project.reportPlans[0]
  if (!plan || plan.briefId !== brief.id || !parseReportOutline(plan.content)) {
    return NextResponse.json({ error: 'Préparez et approuvez le plan avant la rédaction.', code: 'APPROVED_PLAN_REQUIRED' }, { status: 409 })
  }

  const active = await db.generationJob.findFirst({
    where: { userId: user.id, projectId: id, type: 'report', status: { in: ['PENDING', 'PROCESSING', 'RETRY_WAIT'] } },
    orderBy: { createdAt: 'desc' },
  })
  if (active) return NextResponse.json({ jobId: active.id, status: active.status, reused: true }, { status: 202 })

  const idempotencyKey = requestKey(request)
  const existing = await db.generationJob.findFirst({ where: { userId: user.id, idempotencyKey } })
  if (existing) return NextResponse.json({ jobId: existing.id, status: existing.status, reused: true }, { status: 202 })

  const contextHash = createHash('sha256').update(JSON.stringify({
    projectId: id,
    briefId: brief.id,
    planId: plan.id,
    documents: project.documents.map((document) => [document.id, document.contentHash, document.status]),
  })).digest('hex')
  const operationKey = `report:${user.id}:${idempotencyKey}`
  const period = usagePeriod()
  const entitlements = resolveEntitlements(user)
  let reservationCreated = false
  try {
    const reservation = await reserveQuotaForOperation(user.id, operationKey, 'generation', entitlements.monthlyGenerationCredits, period)
    reservationCreated = reservation.created
    const job = await db.$transaction(async (transaction) => {
      const created = await transaction.generationJob.create({
        data: {
          id: randomUUID(),
          userId: user.id,
          projectId: id,
          idempotencyKey,
          contextHash,
          type: 'report',
          status: 'PENDING',
          progress: 0,
          progressMessage: 'Rédaction placée dans la file de traitement…',
          outputData: JSON.stringify({ kind: 'report-job', version: 2, operationKey, planId: plan.id }),
          quotaPeriod: period,
        },
      })
      await transaction.project.update({ where: { id }, data: { status: 'DRAFTING' } })
      return created
    })
    return NextResponse.json({ jobId: job.id, status: job.status }, { status: 202 })
  } catch (error) {
    const duplicate = await db.generationJob.findFirst({ where: { userId: user.id, idempotencyKey } })
    if (duplicate) return NextResponse.json({ jobId: duplicate.id, status: duplicate.status, reused: true }, { status: 202 })
    if (reservationCreated) await releaseQuotaReservation(operationKey).catch(() => undefined)
    if (error instanceof QuotaExceededError) {
      return NextResponse.json({ error: 'Crédits de génération épuisés pour ce mois.', code: 'GENERATION_QUOTA_EXCEEDED' }, { status: 402 })
    }
    if (isSerializationFailure(error)) {
      return NextResponse.json({ error: 'Une autre génération vient d’être lancée. Réessayez.', code: 'CONCURRENT_GENERATION' }, { status: 409 })
    }
    console.error('POST /api/projects/[id]/generate-report queue error:', error)
    return NextResponse.json({ error: 'Impossible de placer la rédaction dans la file.' }, { status: 500 })
  }
}
