import { NextRequest, NextResponse } from 'next/server'

import { getAuthenticatedUser } from '@/lib/auth'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

type LogLevel = 'INFO' | 'WARNING' | 'CRITICAL'

interface AdminLogEvent {
  id: string
  category: 'AUDIT' | 'JOB' | 'AI_USAGE'
  level: LogLevel
  title: string
  detail: string
  actor: string | null
  target: string | null
  createdAt: Date
  metadata?: Record<string, unknown>
}

export async function GET(request: NextRequest) {
  const administrator = await getAuthenticatedUser()
  if (!administrator) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (administrator.role !== 'ADMIN') return NextResponse.json({ error: 'Accès administrateur requis' }, { status: 403 })

  const query = request.nextUrl.searchParams.get('search')?.trim().toLowerCase().slice(0, 100) ?? ''
  const category = request.nextUrl.searchParams.get('category')
  const level = request.nextUrl.searchParams.get('level')
  const requestedLimit = Number(request.nextUrl.searchParams.get('limit') ?? 100)
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 200) : 100

  const [auditLogs, jobs, usage] = await Promise.all([
    db.adminAuditLog.findMany({
      take: 200,
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { name: true, email: true } } },
    }),
    db.generationJob.findMany({
      take: 200,
      orderBy: { updatedAt: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
        project: { select: { title: true } },
      },
    }),
    db.apiUsage.findMany({ take: 200, orderBy: { createdAt: 'desc' } }),
  ])

  const events: AdminLogEvent[] = [
    ...auditLogs.map((log): AdminLogEvent => ({
      id: `audit-${log.id}`,
      category: 'AUDIT',
      level: log.severity,
      title: log.summary,
      detail: log.action,
      actor: log.actor?.name ?? log.actor?.email ?? null,
      target: log.targetLabel,
      createdAt: log.createdAt,
      metadata: typeof log.metadata === 'object' && log.metadata !== null ? log.metadata as Record<string, unknown> : undefined,
    })),
    ...jobs.map((job): AdminLogEvent => ({
      id: `job-${job.id}`,
      category: 'JOB',
      level: job.status === 'FAILED' ? 'CRITICAL' : job.status === 'CANCELLED' ? 'WARNING' : 'INFO',
      title: `${job.type === 'summary' ? 'Synthèse' : 'Rapport'} · ${job.status}`,
      detail: job.errorMessage ?? job.progressMessage ?? `Progression : ${job.progress}%`,
      actor: job.user.name ?? job.user.email ?? null,
      target: job.project.title,
      createdAt: job.updatedAt,
      metadata: { jobId: job.id, progress: job.progress, status: job.status },
    })),
    ...usage.map((record): AdminLogEvent => ({
      id: `usage-${record.id}`,
      category: 'AI_USAGE',
      level: 'INFO',
      title: `Appel IA · ${record.type.replaceAll('_', ' ')}`,
      detail: `${(record.inputTokens + record.outputTokens).toLocaleString('fr-FR')} jetons · $${record.costUsd.toFixed(4)}`,
      actor: record.userId,
      target: record.projectId,
      createdAt: record.createdAt,
      metadata: { inputTokens: record.inputTokens, outputTokens: record.outputTokens, costUsd: record.costUsd },
    })),
  ]

  const filtered = events
    .filter((event) => !category || category === 'ALL' || event.category === category)
    .filter((event) => !level || level === 'ALL' || event.level === level)
    .filter((event) => !query || `${event.title} ${event.detail} ${event.actor ?? ''} ${event.target ?? ''}`.toLowerCase().includes(query))
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, limit)

  return NextResponse.json({ events: filtered, total: filtered.length, generatedAt: new Date().toISOString() })
}
