import { NextRequest, NextResponse } from 'next/server'

import { getAuthenticatedUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { archiveExpiredApiUsage, getUsageRetentionItems, getUsageRetentionStatus } from '@/lib/usage-retention'

export const runtime = 'nodejs'

async function requireAdministrator() {
  const user = await getAuthenticatedUser()
  if (!user) return { response: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) }
  if (user.role !== 'ADMIN') return { response: NextResponse.json({ error: 'Accès administrateur requis' }, { status: 403 }) }
  return { user }
}

export async function GET(request: NextRequest) {
  const authorization = await requireAdministrator()
  if ('response' in authorization) return authorization.response
  const cursor = request.nextUrl.searchParams.get('cursor') ?? undefined
  const requestedLimit = Number(request.nextUrl.searchParams.get('limit') ?? 100)
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 200) : 100
  const [retention, page] = await Promise.all([getUsageRetentionStatus(), getUsageRetentionItems(new Date(), cursor, limit)])
  return NextResponse.json({ retention, ...page })
}

export async function POST() {
  const authorization = await requireAdministrator()
  if ('response' in authorization) return authorization.response

  const result = await archiveExpiredApiUsage()
  await db.adminAuditLog.create({
    data: {
      actorId: authorization.user.id,
      action: 'AI_USAGE_RETENTION_RUN',
      targetType: 'SYSTEM',
      targetLabel: 'Données de consommation IA',
      summary: result.archivedRows > 0
        ? `${result.archivedRows} enregistrements IA agrégés mensuellement puis supprimés`
        : 'Politique de conservation IA vérifiée, aucune donnée à archiver',
      metadata: result,
    },
  })

  return NextResponse.json({ result, retention: await getUsageRetentionStatus() })
}
