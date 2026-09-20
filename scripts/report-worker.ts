import { loadEnvConfig } from '@next/env'

loadEnvConfig(process.cwd())

let stopping = false
process.on('SIGINT', () => { stopping = true })
process.on('SIGTERM', () => { stopping = true })

async function main() {
  // Dynamic imports happen after Next's environment loader so Prisma and the
  // provider client see the same .env.local values as the web process.
  const [{ processNextReportJob }, { db }] = await Promise.all([
    import('../src/lib/report-job'),
    import('../src/lib/db'),
  ])
  const pollMilliseconds = Math.max(500, Number(process.env.REPORT_WORKER_POLL_MS ?? 2_000))
  console.log('[report-worker] started')
  try {
    while (!stopping) {
      const processed = await processNextReportJob()
      if (!processed) await new Promise((resolve) => setTimeout(resolve, pollMilliseconds))
    }
  } finally {
    await db.$disconnect()
    console.log('[report-worker] stopped')
  }
}

main().catch((error) => {
  console.error('[report-worker] fatal error', error)
  process.exitCode = 1
})
