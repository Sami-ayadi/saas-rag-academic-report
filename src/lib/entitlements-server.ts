import type { Entitlements } from './entitlements'
import { db, type DbTransaction } from './db'

export class QuotaExceededError extends Error {
  readonly kind = 'quota_exceeded' as const
  constructor(message: string) {
    super(message)
    this.name = 'QuotaExceededError'
  }
}

export function isSerializationFailure(error: unknown): boolean {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: string }).code
    return code === 'P2034' || code === '40001'
  }
  return false
}

export function usagePeriod(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

export interface QuotaCheck {
  allowed: boolean
  used: number
  limit: number
  remaining: number
}

export async function consumeQuota(
  userId: string,
  kind: 'generation' | 'regeneration',
  limit: number,
  period: string,
): Promise<QuotaCheck> {
  if (limit <= 0) {
    throw new QuotaExceededError(`No ${kind} credits available for this period`)
  }

  // The (user, UTC month, kind) unique key creates a fresh period lazily.
  // A conditional update enforces the limit even under concurrent requests.
  try {
    await db.entitlementUsage.create({ data: { userId, period, kind, used: 1 } })
    return { allowed: true, used: 1, limit, remaining: limit - 1 }
  } catch (error) {
    if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'P2002') throw error
  }

  const updatedRows = await db.entitlementUsage.updateMany({
    where: { userId, period, kind, used: { lt: limit } },
    data: { used: { increment: 1 } },
  })
  if (updatedRows.count !== 1) throw new QuotaExceededError(`Monthly ${kind} limit reached (${limit})`)
  const updated = await db.entitlementUsage.findUniqueOrThrow({
    where: { userId_period_kind: { userId, period, kind } },
  })
  return { allowed: true, used: updated.used, limit, remaining: Math.max(0, limit - updated.used) }
}

export async function refundQuota(
  userId: string,
  kind: 'generation' | 'regeneration',
  period: string,
): Promise<void> {
  await db.entitlementUsage.updateMany({
    where: { userId, period, kind, used: { gt: 0 } },
    data: { used: { decrement: 1 } },
  })
}

export async function quotaSnapshot(
  userId: string,
  entitlements: Entitlements,
  period: string,
): Promise<{
  generation: QuotaCheck
  regeneration: QuotaCheck
}> {
  const [generation, regeneration] = await Promise.all([
    db.entitlementUsage.findUnique({
      where: { userId_period_kind: { userId, period, kind: 'generation' } },
    }),
    db.entitlementUsage.findUnique({
      where: { userId_period_kind: { userId, period, kind: 'regeneration' } },
    }),
  ])

  return {
    generation: {
      allowed: (generation?.used ?? 0) < entitlements.monthlyGenerationCredits,
      used: generation?.used ?? 0,
      limit: entitlements.monthlyGenerationCredits,
      remaining: Math.max(0, entitlements.monthlyGenerationCredits - (generation?.used ?? 0)),
    },
    regeneration: {
      allowed: (regeneration?.used ?? 0) < entitlements.monthlyRegenerations,
      used: regeneration?.used ?? 0,
      limit: entitlements.monthlyRegenerations,
      remaining: Math.max(0, entitlements.monthlyRegenerations - (regeneration?.used ?? 0)),
    },
  }
}

export async function withProjectSlot<T>(
  userId: string,
  limit: number,
  fn: (transaction: DbTransaction) => Promise<T>,
): Promise<T> {
  if (limit <= 0) {
    throw new QuotaExceededError('Project creation not allowed on your plan')
  }

  return db.$transaction(async (tx) => {
    const count = await tx.project.count({ where: { userId } })
    if (count >= limit) {
      throw new QuotaExceededError(`Project limit reached (${limit})`)
    }
    return fn(tx)
  }, { isolationLevel: 'Serializable' })
}
