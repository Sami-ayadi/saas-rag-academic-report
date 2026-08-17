import { describe, expect, it } from 'vitest'

import { configuredUsageRetentionDays, usageRetentionCutoff } from './usage-retention'

describe('AI usage retention', () => {
  it('defaults to 180 days and constrains configuration to 90–180 days', () => {
    expect(configuredUsageRetentionDays(undefined)).toBe(180)
    expect(configuredUsageRetentionDays('30')).toBe(90)
    expect(configuredUsageRetentionDays('120')).toBe(120)
    expect(configuredUsageRetentionDays('365')).toBe(180)
    expect(configuredUsageRetentionDays('invalid')).toBe(180)
  })

  it('uses a stable UTC-day cutoff', () => {
    expect(usageRetentionCutoff(new Date('2026-08-17T23:30:00.000Z'), 180).toISOString())
      .toBe('2026-02-18T00:00:00.000Z')
  })
})
