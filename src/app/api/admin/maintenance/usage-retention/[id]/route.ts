import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'

import { apiRequestErrorResponse, readJsonBody } from '@/lib/api-input'
import { getAuthenticatedUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { usageRetentionCutoff } from '@/lib/usage-retention'

export const runtime = 'nodejs'

const retentionDecisionSchema = z.object({
  retained: z.boolean(),
  reason: z.string().trim().max(500).optional(),
}).strict()

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const administrator = await getAuthenticatedUser()
    if (!administrator) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    if (administrator.role !== 'ADMIN') return NextResponse.json({ error: 'Accès administrateur requis' }, { status: 403 })

    const { id } = await context.params
    const decision = await readJsonBody(request, retentionDecisionSchema)
    const existing = await db.apiUsage.findUnique({
      where: { id },
      select: { id: true, userId: true, projectId: true, type: true, createdAt: true },
    })
    if (!existing) return NextResponse.json({ error: 'Enregistrement introuvable ou déjà archivé' }, { status: 404 })
    if (existing.createdAt >= usageRetentionCutoff()) {
      return NextResponse.json({ error: "Cet enregistrement n'est pas encore concerné par l'archivage" }, { status: 409 })
    }

    const usage = await db.$transaction(async (transaction) => {
      const updated = await transaction.apiUsage.update({
        where: { id },
        data: decision.retained
          ? {
              retentionExempt: true,
              retentionReason: decision.reason ?? 'Conservation manuelle depuis la console',
              retentionMarkedAt: new Date(),
              retentionMarkedBy: administrator.id,
            }
          : { retentionExempt: false, retentionReason: null, retentionMarkedAt: null, retentionMarkedBy: null },
        select: { id: true, retentionExempt: true, retentionReason: true, retentionMarkedAt: true },
      })
      await transaction.adminAuditLog.create({
        data: {
          actorId: administrator.id,
          action: decision.retained ? 'AI_USAGE_RETAINED' : 'AI_USAGE_RETENTION_RELEASED',
          targetType: 'API_USAGE',
          targetId: id,
          targetLabel: `${existing.type} · ${existing.userId}`,
          summary: decision.retained
            ? 'Un enregistrement IA a été exclu de l’archivage'
            : 'Un enregistrement IA a été réintégré à la prochaine archive',
          metadata: { projectId: existing.projectId, createdAt: existing.createdAt, reason: decision.reason },
        },
      })
      return updated
    })

    return NextResponse.json({ usage })
  } catch (error) {
    const requestError = apiRequestErrorResponse(error)
    if (requestError) return requestError
    console.error('PATCH usage retention decision error:', error)
    return NextResponse.json({ error: 'Impossible de modifier la décision de conservation' }, { status: 500 })
  }
}
