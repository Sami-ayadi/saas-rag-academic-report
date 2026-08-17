import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'

import { canReviewRoleChange } from '@/lib/admin-role-policy'
import { apiRequestErrorResponse, readJsonBody } from '@/lib/api-input'
import { getAuthenticatedUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { createNotification } from '@/lib/notifications'

export const runtime = 'nodejs'

const reviewSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  reason: z.string().trim().max(500).optional(),
}).strict()

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const administrator = await getAuthenticatedUser()
    if (!administrator) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    if (administrator.role !== 'ADMIN') return NextResponse.json({ error: 'Accès administrateur requis' }, { status: 403 })
    const { id } = await context.params
    const input = await readJsonBody(request, reviewSchema)
    const roleRequest = await db.roleChangeRequest.findUnique({ where: { id } })
    if (!roleRequest) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })
    if (roleRequest.status !== 'PENDING') return NextResponse.json({ error: 'Cette demande a déjà été traitée' }, { status: 409 })
    if (!canReviewRoleChange({ reviewerId: administrator.id, requestedById: roleRequest.requestedById, targetUserId: roleRequest.targetUserId })) {
      return NextResponse.json({ error: 'La validation doit être effectuée par un autre administrateur, non concerné par la demande' }, { status: 403 })
    }

    const target = await db.user.findUnique({ where: { id: roleRequest.targetUserId }, select: { id: true, name: true, email: true, role: true } })
    if (!target) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
    if (target.role !== roleRequest.currentRole) return NextResponse.json({ error: 'Le rôle a changé depuis la création de la demande' }, { status: 409 })

    const status = input.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED'
    const updated = await db.$transaction(async (transaction) => {
      if (input.decision === 'APPROVE') await transaction.user.update({ where: { id: target.id }, data: { role: roleRequest.requestedRole } })
      const reviewed = await transaction.roleChangeRequest.update({ where: { id }, data: {
        status, reviewedById: administrator.id, reviewedAt: new Date(), reviewReason: input.reason,
      } })
      await transaction.adminAuditLog.create({ data: {
        actorId: administrator.id, action: input.decision === 'APPROVE' ? 'ROLE_CHANGE_APPROVED' : 'ROLE_CHANGE_REJECTED',
        severity: 'WARNING', targetType: 'USER', targetId: target.id, targetLabel: target.name ?? target.email ?? target.id,
        summary: input.decision === 'APPROVE'
          ? `Changement de rôle approuvé : ${roleRequest.currentRole} → ${roleRequest.requestedRole}`
          : `Changement de rôle refusé : ${roleRequest.currentRole} → ${roleRequest.requestedRole}`,
        metadata: { requestId: id, reviewReason: input.reason },
      } })
      const decisionLabel = input.decision === 'APPROVE' ? 'approuvée' : 'refusée'
      const recipients = [...new Set([roleRequest.requestedById, roleRequest.targetUserId])]
      await Promise.all(recipients.map((userId) => createNotification({
        userId, type: `ROLE_CHANGE_${status}`, title: `Demande de rôle ${decisionLabel}`,
        message: `${target.name ?? target.email ?? target.id} : ${roleRequest.currentRole} → ${roleRequest.requestedRole}`,
        linkView: userId === roleRequest.targetUserId ? 'settings' : 'admin', metadata: { requestId: id },
      }, transaction)))
      return reviewed
    })
    return NextResponse.json({ request: updated })
  } catch (error) {
    const requestError = apiRequestErrorResponse(error)
    if (requestError) return requestError
    console.error('PATCH /api/admin/role-requests/[id] error:', error)
    return NextResponse.json({ error: 'Impossible de traiter la demande' }, { status: 500 })
  }
}
