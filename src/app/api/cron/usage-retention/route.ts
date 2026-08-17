import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { archiveExpiredApiUsage } from '@/lib/usage-retention'

export const runtime = 'nodejs'

function isAuthorized(request: NextRequest) {
  const expected = process.env.RETENTION_CRON_SECRET
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!expected || !supplied) return false
  const expectedBuffer = Buffer.from(expected)
  const suppliedBuffer = Buffer.from(supplied)
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer)
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const result = await archiveExpiredApiUsage()
  await db.adminAuditLog.create({
    data: {
      action: 'AI_USAGE_RETENTION_SCHEDULED',
      targetType: 'SYSTEM',
      targetLabel: 'Données de consommation IA',
      summary: `Archivage planifié terminé : ${result.archivedRows} enregistrement(s) traité(s)`,
      metadata: result,
    },
  })
  return NextResponse.json({ ok: true, result })
}
