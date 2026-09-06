import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { db } from './db'
import { consumeQuota, readQuota, refundQuota, usagePeriod } from './entitlements-server'

/**
 * Real-database quota tests.
 *
 * They need PostgreSQL and are opt-in so `npm test` stays green in CI and in
 * machines without a running container:
 *
 *   docker compose up -d postgres
 *   $env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rag_report?schema=public"
 *   $env:RUN_ENTITLEMENT_INTEGRATION="1"
 *   npm run db:deploy
 *   npm test
 */
const integrationEnabled =
  Boolean(process.env.DATABASE_URL) && process.env.RUN_ENTITLEMENT_INTEGRATION === '1'

const userId = `entitlements-test-${Date.now()}`
const period = usagePeriod()

describe.runIf(integrationEnabled)('entitlements-server quota integration', () => {
  beforeAll(async () => {
    await db.$queryRaw`SELECT 1`
    await db.user.create({
      data: { id: userId, email: `${userId}@test.local`, tier: 'FREE' },
    })
  })

  afterAll(async () => {
    await db.user.delete({ where: { id: userId } }).catch(() => undefined)
    await db.$disconnect()
  })

  it('rejects a generation once the monthly limit is exhausted', async () => {
    const limit = 2
    const first = await consumeQuota(userId, 'generation', limit, period)
    const second = await consumeQuota(userId, 'generation', limit, period)
    const third = await consumeQuota(userId, 'generation', limit, period)

    expect(first.allowed).toBe(true)
    expect(second.allowed).toBe(true)
    expect(third.allowed).toBe(false)
    expect(third.used).toBe(limit)
    expect(third.remaining).toBe(0)
    expect(await readQuota(userId, 'generation', period)).toBe(limit)
  })

  it('allows exactly `limit` winners under a burst of parallel generations', async () => {
    const limit = 5
    const burst = Array.from({ length: 20 }, () =>
      consumeQuota(userId, 'generation', limit, period),
    )
    const results = await Promise.all(burst)
    const winners = results.filter((result) => result.allowed)

    expect(winners).toHaveLength(limit)
    expect(results.filter((result) => !result.allowed)).toHaveLength(20 - limit)
    expect(await readQuota(userId, 'generation', period)).toBe(limit)
  })

  it('refunds a failed generation and never decrements below zero', async () => {
    const before = await readQuota(userId, 'regeneration', period)
    const consumed = await consumeQuota(userId, 'regeneration', 10, period)
    expect(consumed.allowed).toBe(true)

    await refundQuota(userId, 'regeneration', period)
    expect(await readQuota(userId, 'regeneration', period)).toBe(before)

    // Refunding an empty counter is a no-op rather than going negative.
    await refundQuota(userId, 'regeneration', period)
    expect(await readQuota(userId, 'regeneration', period)).toBe(before)
  })
})