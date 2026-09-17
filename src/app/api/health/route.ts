import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { isLlmConfigured, isLlmReachable } from '@/lib/report-generation'

export const runtime = 'nodejs'

export async function GET() {
  const [database, llmReachable] = await Promise.all([
    db.$queryRaw`SELECT 1`.then(() => true, () => false),
    isLlmReachable(),
  ])
  return NextResponse.json({
    status: database ? 'ok' : 'degraded',
    database: database ? 'reachable' : 'unreachable',
    llm: !isLlmConfigured() ? 'not_configured' : llmReachable ? 'reachable' : 'unreachable',
  }, { status: database ? 200 : 503, headers: { 'Cache-Control': 'no-store' } })
}
