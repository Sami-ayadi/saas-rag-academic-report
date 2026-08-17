import { Prisma } from '@prisma/client'

import { db } from './db'

const DEFAULT_RETENTION_DAYS = 180
const MIN_RETENTION_DAYS = 90
const MAX_RETENTION_DAYS = 180
const DAY_MS = 86_400_000

export function configuredUsageRetentionDays(value = process.env.AI_USAGE_RETENTION_DAYS) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) return DEFAULT_RETENTION_DAYS
  return Math.min(Math.max(parsed, MIN_RETENTION_DAYS), MAX_RETENTION_DAYS)
}

export function usageRetentionCutoff(now = new Date(), retentionDays = configuredUsageRetentionDays()) {
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return new Date(todayUtc - retentionDays * DAY_MS)
}

export async function getUsageRetentionStatus(now = new Date()) {
  const retentionDays = configuredUsageRetentionDays()
  const cutoff = usageRetentionCutoff(now, retentionDays)
  const [detailedRows, eligibleRows, retainedRows, oldestDetailed, monthlyRows] = await Promise.all([
    db.apiUsage.count(),
    db.apiUsage.count({ where: { createdAt: { lt: cutoff }, retentionExempt: false } }),
    db.apiUsage.count({ where: { createdAt: { lt: cutoff }, retentionExempt: true } }),
    db.apiUsage.findFirst({ orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
    db.apiUsageMonthly.count(),
  ])

  return {
    retentionDays,
    cutoff: cutoff.toISOString(),
    detailedRows,
    eligibleRows,
    retainedRows,
    monthlyRows,
    oldestDetailedAt: oldestDetailed?.createdAt.toISOString() ?? null,
  }
}

export async function getUsageRetentionItems(now = new Date(), cursor?: string, limit = 100) {
  const retentionDays = configuredUsageRetentionDays()
  const cutoff = usageRetentionCutoff(now, retentionDays)
  const records = await db.apiUsage.findMany({
    where: { createdAt: { lt: cutoff } },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      userId: true,
      projectId: true,
      type: true,
      inputTokens: true,
      outputTokens: true,
      costUsd: true,
      createdAt: true,
      retentionExempt: true,
      retentionReason: true,
      retentionMarkedAt: true,
    },
  })
  const hasMore = records.length > limit
  const pageRecords = records.slice(0, limit)
  const userIds = [...new Set(pageRecords.map((record) => record.userId))]
  const projectIds = [...new Set(pageRecords.flatMap((record) => record.projectId ? [record.projectId] : []))]
  const [users, projects] = await Promise.all([
    db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }),
    db.project.findMany({ where: { id: { in: projectIds } }, select: { id: true, title: true } }),
  ])
  const userById = new Map(users.map((user) => [user.id, user]))
  const projectById = new Map(projects.map((project) => [project.id, project]))

  const items = pageRecords.map((record) => ({
    ...record,
    tokens: record.inputTokens + record.outputTokens,
    user: userById.get(record.userId) ?? null,
    project: record.projectId ? projectById.get(record.projectId) ?? null : null,
  }))
  return { items, nextCursor: hasMore ? items.at(-1)?.id ?? null : null }
}

export async function archiveExpiredApiUsage(now = new Date()) {
  const retentionDays = configuredUsageRetentionDays()
  const cutoff = usageRetentionCutoff(now, retentionDays)

  return db.$transaction(async (transaction) => {
    const expired = await transaction.apiUsage.aggregate({
      where: { createdAt: { lt: cutoff }, retentionExempt: false },
      _count: { _all: true },
      _sum: { inputTokens: true, outputTokens: true, costUsd: true },
    })

    if (expired._count._all === 0) {
      return { retentionDays, cutoff: cutoff.toISOString(), archivedRows: 0, tokens: 0, costUsd: 0 }
    }

    await transaction.$executeRaw(Prisma.sql`
      INSERT INTO "ApiUsageMonthly" (
        "month", "userId", "type", "inputTokens", "outputTokens", "costUsd", "requestCount", "lastAggregatedAt"
      )
      SELECT
        date_trunc('month', "createdAt"),
        "userId",
        "type",
        SUM("inputTokens")::integer,
        SUM("outputTokens")::integer,
        SUM("costUsd"),
        COUNT(*)::integer,
        NOW()
      FROM "ApiUsage"
      WHERE "createdAt" < ${cutoff} AND "retentionExempt" = false
      GROUP BY date_trunc('month', "createdAt"), "userId", "type"
      ON CONFLICT ("month", "userId", "type") DO UPDATE SET
        "inputTokens" = "ApiUsageMonthly"."inputTokens" + EXCLUDED."inputTokens",
        "outputTokens" = "ApiUsageMonthly"."outputTokens" + EXCLUDED."outputTokens",
        "costUsd" = "ApiUsageMonthly"."costUsd" + EXCLUDED."costUsd",
        "requestCount" = "ApiUsageMonthly"."requestCount" + EXCLUDED."requestCount",
        "lastAggregatedAt" = NOW()
    `)

    await transaction.apiUsage.deleteMany({ where: { createdAt: { lt: cutoff }, retentionExempt: false } })

    return {
      retentionDays,
      cutoff: cutoff.toISOString(),
      archivedRows: expired._count._all,
      tokens: (expired._sum.inputTokens ?? 0) + (expired._sum.outputTokens ?? 0),
      costUsd: expired._sum.costUsd ?? 0,
    }
  })
}
