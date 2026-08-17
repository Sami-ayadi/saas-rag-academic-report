import { describe, expect, it } from 'vitest'

import { summarizeDailyUsage, usageWindowStart } from './admin-metrics'

describe('admin usage metrics', () => {
  const now = new Date('2026-08-17T16:30:00.000Z')

  it('starts a seven-day window at UTC midnight six days earlier', () => {
    expect(usageWindowStart(now).toISOString()).toBe('2026-08-11T00:00:00.000Z')
  })

  it('places usage on the correct day and returns matching window totals', () => {
    const result = summarizeDailyUsage(now, [
      { createdAt: new Date('2026-08-17T00:01:00.000Z'), inputTokens: 100, outputTokens: 25, costUsd: 0.1 },
      { createdAt: new Date('2026-08-17T23:59:00.000Z'), inputTokens: 50, outputTokens: 10, costUsd: 0.05 },
      { createdAt: new Date('2026-08-14T12:00:00.000Z'), inputTokens: 20, outputTokens: 5, costUsd: 0.01 },
    ])

    expect(result.dailyUsage).toHaveLength(7)
    expect(result.dailyUsage.at(-1)).toEqual({ date: '2026-08-17', tokens: 185, costUsd: 0.15000000000000002, requests: 2 })
    expect(result.totals).toEqual({ tokens: 210, costUsd: 0.16000000000000003, requests: 3 })
  })
})
