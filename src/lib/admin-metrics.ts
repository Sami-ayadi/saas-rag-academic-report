const DAY_MS = 86_400_000

export interface UsageRecord {
  createdAt: Date
  costUsd: number
  inputTokens: number
  outputTokens: number
}

export function usageWindowStart(now: Date, days = 7) {
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return new Date(todayUtc - (days - 1) * DAY_MS)
}

export function summarizeDailyUsage(now: Date, records: UsageRecord[], days = 7) {
  const start = usageWindowStart(now, days)
  const buckets = new Map<string, { costUsd: number; tokens: number; requests: number }>()

  for (const record of records) {
    const key = record.createdAt.toISOString().slice(0, 10)
    const bucket = buckets.get(key) ?? { costUsd: 0, tokens: 0, requests: 0 }
    bucket.costUsd += record.costUsd
    bucket.tokens += record.inputTokens + record.outputTokens
    bucket.requests += 1
    buckets.set(key, bucket)
  }

  const dailyUsage = Array.from({ length: days }, (_, index) => {
    const date = new Date(start.getTime() + index * DAY_MS)
    const key = date.toISOString().slice(0, 10)
    return { date: key, ...(buckets.get(key) ?? { costUsd: 0, tokens: 0, requests: 0 }) }
  })

  return {
    dailyUsage,
    totals: dailyUsage.reduce(
      (total, day) => ({
        costUsd: total.costUsd + day.costUsd,
        tokens: total.tokens + day.tokens,
        requests: total.requests + day.requests,
      }),
      { costUsd: 0, tokens: 0, requests: 0 },
    ),
  }
}
