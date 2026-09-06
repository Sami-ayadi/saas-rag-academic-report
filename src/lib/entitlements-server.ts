import { Prisma } from '@prisma/client'

import { db } from './db'
import { resolveEntitlements, type Entitlements, type EntitlementSubject, type QuotaKind } from './entitlements'

/**
 * Database-backed side of the entitlement module.
 *
 * Quotas are consumed with a guarded `UPDATE ... WHERE used < limit`, which
 * PostgreSQL re-evaluates after taking the row lock. Two concurrent generations
 * therefore serialise on the counter row and the second one is rejected instead
 * of both reading a stale `used` value.
 */

/** UTC calendar month, e.g. `2026-09`. Quota rows reset simply by keying a new period. */
export function usagePeriod(now: Date = new Date()) {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

export function entitlementsFor(subject: EntitlementSubject): Entitlements {
  return resolveEntitlements(subject)
}

export interface QuotaOutcome {
  allowed: boolean
  used: number
  limit: number
  remaining: number
}

async function ensureUsageRow(userId: string, period: string, kind: QuotaKind) {
  try {
    await db.entitlementUsage.upsert({
      where: { userId_period_kind: { userId, period, kind } },
      create: { userId, period, kind, used: 0 },
      update: {},
    })
  } catch (error) {
    // A concurrent request inserted the same row first; that is the desired state.
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error
  }
}

/**
 * Atomically consume one unit of a monthly quota.
 * Returns `allowed: false` when the limit is already reached; nothing is written in that case.
 */
export async function consumeQuota(
  userId: string,
  kind: QuotaKind,
  limit: number,
  period: string = usagePeriod(),
): Promise<QuotaOutcome> {
  if (limit <= 0) return { allowed: false, used: await readQuota(userId, kind, period), limit, remaining: 0 }

  await ensureUsageRow(userId, period, kind)

  return db.$transaction(async (transaction) => {
    const guarded = await transaction.entitlementUsage.updateMany({
      where: { userId, period, kind, used: { lt: limit } },
      data: { used: { increment: 1 } },
    })
    const row = await transaction.entitlementUsage.findUnique({
      where: { userId_period_kind: { userId, period, kind } },
      select: { used: true },
    })
    const used = row?.used ?? 0
    if (guarded.count === 1 && kind === 'generation') {
      // Mirror the authoritative counter so existing dashboards stay accurate and
      // reset with the period instead of accumulating for ever.
      await transaction.user.update({ where: { id: userId }, data: { creditsUsed: used } })
    }
    return { allowed: guarded.count === 1, used, limit, remaining: Math.max(0, limit - used) }
  })
}

/**
 * Refund policy: a generation that fails before producing a stored artefact returns
 * its credit. Successful generations are never refunded, even if the user deletes
 * the report afterwards.
 */
export async function refundQuota(
  userId: string,
  kind: QuotaKind,
  period: string = usagePeriod(),
): Promise<void> {
  await db.$transaction(async (transaction) => {
    const refunded = await transaction.entitlementUsage.updateMany({
      where: { userId, period, kind, used: { gt: 0 } },
      data: { used: { decrement: 1 } },
    })
    if (refunded.count !== 1 || kind !== 'generation') return
    const row = await transaction.entitlementUsage.findUnique({
      where: { userId_period_kind: { userId, period, kind } },
      select: { used: true },
    })
    await transaction.user.update({ where: { id: userId }, data: { creditsUsed: row?.used ?? 0 } })
  })
}

export async function readQuota(
  userId: string,
  kind: QuotaKind,
  period: string = usagePeriod(),
): Promise<number> {
  const row = await db.entitlementUsage.findUnique({
    where: { userId_period_kind: { userId, period, kind } },
    select: { used: true },
  })
  return row?.used ?? 0
}

export async function quotaSnapshot(userId: string, entitlements: Entitlements, period: string = usagePeriod()) {
  const [generation, regeneration] = await Promise.all([
    readQuota(userId, 'generation', period),
    readQuota(userId, 'regeneration', period),
  ])
  return {
    period,
    generation: {
      used: generation,
      limit: entitlements.monthlyGenerationCredits,
      remaining: Math.max(0, entitlements.monthlyGenerationCredits - generation),
    },
    regeneration: {
      used: regeneration,
      limit: entitlements.monthlyRegenerations,
      remaining: Math.max(0, entitlements.monthlyRegenerations - regeneration),
    },
  }
}

export class QuotaExceededError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'QuotaExceededError'
  }
}

/**
 * Serializable transactions make the project count-then-create pair safe against a
 * burst of parallel creations from the same account.
 */
export async function withProjectSlot<T>(
  userId: string,
  activeProjectLimit: number,
  create: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return db.$transaction(
    async (transaction) => {
      const active = await transaction.project.count({ where: { userId } })
      if (active >= activeProjectLimit) {
        throw new QuotaExceededError(
          `Votre plan autorise ${activeProjectLimit} projet(s) actif(s). Supprimez un projet ou changez de plan.`,
        )
      }
      return create(transaction)
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}

export function isSerializationFailure(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034'
}
