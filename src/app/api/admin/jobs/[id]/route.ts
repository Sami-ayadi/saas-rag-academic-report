import { NextResponse } from 'next/server'

import { getAuthenticatedUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { createNotification } from '@/lib/notifications'

export const runtime = 'nodejs'

export async function PATCH(_request: Request, context: { params: Promise<{ id: string }> }) {
  const administrator = await getAuthenticatedUser()
  if (!administrator) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (administrator.role !== 'ADMIN') return NextResponse.json({ error: 'Accès administrateur requis' }, { status: 403 })

  const { id } = await context.params
  const existing = await db.generationJob.findUnique({
    where: { id },
    select: { id: true, status: true, type: true, project: { select: { title: true } } },
  })
  if (!existing) return NextResponse.json({ error: 'Traitement introuvable' }, { status: 404 })
  if (!['PENDING', 'PROCESSING'].includes(existing.status)) {
    return NextResponse.json({ error: 'Seul un traitement actif peut être annulé' }, { status: 409 })
  }

  const job = await db.$transaction(async (transaction) => {
    const cancelled = await transaction.generationJob.update({
      where: { id },
      data: { status: 'CANCELLED', completedAt: new Date(), progressMessage: 'Annulé par un administrateur' },
    })
    await transaction.adminAuditLog.create({
      data: {
        actorId: administrator.id,
        action: 'JOB_CANCELLED',
        severity: 'WARNING',
        targetType: 'GENERATION_JOB',
        targetId: id,
        targetLabel: existing.project.title,
        summary: `Traitement ${existing.type} annulé par un administrateur`,
        metadata: { previousStatus: existing.status },
      },
    })
    await createNotification({
      userId: cancelled.userId, type: 'JOB_CANCELLED', title: 'Traitement annulé',
      message: `Le traitement du projet « ${existing.project.title} » a été annulé par un administrateur.`,
      linkView: 'dashboard', metadata: { jobId: cancelled.id, projectId: cancelled.projectId },
    }, transaction)
    return cancelled
  })

  return NextResponse.json({ job })
}
