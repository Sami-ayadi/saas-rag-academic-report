import { NextResponse } from 'next/server'

import { getAuthenticatedUser } from '@/lib/auth'
import { summarizeDailyUsage, usageWindowStart } from '@/lib/admin-metrics'
import { db } from '@/lib/db'
import { getUsageRetentionStatus } from '@/lib/usage-retention'

export const runtime = 'nodejs'

const DAY_MS = 86_400_000

export async function GET() {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Accès administrateur requis' }, { status: 403 })

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS)
  const sevenDaysAgo = usageWindowStart(now)
  const oneDayAgo = new Date(now.getTime() - DAY_MS)
  const backupValue = process.env.DATABASE_LAST_BACKUP_AT?.trim()
  const backupDate = backupValue ? new Date(backupValue) : null
  const validBackupDate = backupDate && !Number.isNaN(backupDate.getTime()) ? backupDate : null

  const [
    users, activeUsers, newUsers, projects, reports, documentStats, usage,
    archivedUsage, recentUsage, jobGroups, failedJobs24h, recentProjects, recentAudit, tierGroups, retention,
    demographicUsers, sessions,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { isActive: true } }),
    db.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    db.project.count(),
    db.report.count(),
    db.document.aggregate({ _count: { _all: true }, _sum: { size: true } }),
    db.apiUsage.aggregate({ _sum: { costUsd: true, inputTokens: true, outputTokens: true } }),
    db.apiUsageMonthly.aggregate({ _sum: { costUsd: true, inputTokens: true, outputTokens: true } }),
    db.apiUsage.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true, costUsd: true, inputTokens: true, outputTokens: true },
      orderBy: { createdAt: 'asc' },
    }),
    db.generationJob.groupBy({ by: ['status'], _count: { _all: true } }),
    db.generationJob.count({ where: { status: 'FAILED', updatedAt: { gte: oneDayAgo } } }),
    db.project.findMany({
      take: 6,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true, title: true, status: true, updatedAt: true,
        user: { select: { id: true, name: true, email: true } },
        _count: { select: { documents: true, reports: true } },
      },
    }),
    db.adminAuditLog.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, action: true, severity: true, summary: true, targetLabel: true, createdAt: true,
        actor: { select: { name: true, email: true } },
      },
    }),
    db.user.groupBy({ by: ['tier'], _count: { _all: true } }),
    getUsageRetentionStatus(now),
    db.user.findMany({ select: { birthDate: true, gender: true } }),
    db.session.findMany({ where: { expires: { gt: now } }, select: { createdAt: true, lastSeenAt: true } }),
  ])

  const jobsByStatus = Object.fromEntries(jobGroups.map((group) => [group.status, group._count._all]))
  const completedJobs = jobsByStatus.COMPLETED ?? 0
  const failedJobs = jobsByStatus.FAILED ?? 0
  const decidedJobs = completedJobs + failedJobs
  const activeJobs = (jobsByStatus.PENDING ?? 0) + (jobsByStatus.PROCESSING ?? 0)

  const { dailyUsage, totals: usage7d } = summarizeDailyUsage(now, recentUsage)
  const ageGroups = { '<18': 0, '18-24': 0, '25-34': 0, '35-44': 0, '45-54': 0, '55+': 0, 'Non renseigné': 0 }
  const genderGroups: Record<string, number> = {}
  for (const profile of demographicUsers) {
    if (!profile.birthDate) ageGroups['Non renseigné'] += 1
    else {
      const age = Math.floor((now.getTime() - profile.birthDate.getTime()) / (365.2425 * DAY_MS))
      const bucket = age < 18 ? '<18' : age < 25 ? '18-24' : age < 35 ? '25-34' : age < 45 ? '35-44' : age < 55 ? '45-54' : '55+'
      ageGroups[bucket] += 1
    }
    const gender = profile.gender?.trim() || 'Non renseigné'
    genderGroups[gender] = (genderGroups[gender] ?? 0) + 1
  }
  const sessionMinutes = sessions.map((session) => Math.max(0, (session.lastSeenAt.getTime() - session.createdAt.getTime()) / 60_000))

  return NextResponse.json({
    stats: {
      users, activeUsers, newUsers, projects, reports,
      documents: documentStats._count._all,
      storageBytes: documentStats._sum.size ?? 0,
      costUsd: (usage._sum.costUsd ?? 0) + (archivedUsage._sum.costUsd ?? 0),
      tokens: (usage._sum.inputTokens ?? 0) + (usage._sum.outputTokens ?? 0)
        + (archivedUsage._sum.inputTokens ?? 0) + (archivedUsage._sum.outputTokens ?? 0),
      costUsd7d: usage7d.costUsd,
      tokens7d: usage7d.tokens,
      requests7d: usage7d.requests,
      activeJobs, failedJobs24h,
      successRate: decidedJobs > 0 ? Math.round((completedJobs / decidedJobs) * 100) : 100,
    },
    jobsByStatus,
    usersByTier: Object.fromEntries(tierGroups.map((group) => [group.tier, group._count._all])),
    dailyUsage,
    recentProjects,
    recentAudit,
    retention,
    analytics: {
      ageGroups,
      genderGroups,
      sessions: {
        active: sessions.filter((session) => session.lastSeenAt >= new Date(now.getTime() - 30 * 60_000)).length,
        total: sessions.length,
        averageMinutes: sessionMinutes.length ? Math.round(sessionMinutes.reduce((sum, value) => sum + value, 0) / sessionMinutes.length) : 0,
      },
    },
    backup: {
      configured: Boolean(validBackupDate),
      lastCompletedAt: validBackupDate?.toISOString() ?? null,
      provider: process.env.DATABASE_BACKUP_PROVIDER?.trim() || null,
    },
    generatedAt: now.toISOString(),
  })
}
