import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'

import { canRequestRoleChange } from '@/lib/admin-role-policy'
import { apiRequestErrorResponse, readJsonBody } from '@/lib/api-input'
import { getAuthenticatedUser, isPlatformOwner } from '@/lib/auth'
import { db } from '@/lib/db'
import { notifyAdministrators } from '@/lib/notifications'

export const runtime = 'nodejs'

const requestSchema = z.object({
  targetUserId: z.string().min(1),
  requestedRole: z.enum(['USER', 'ADMIN']),
  reason: z.string().trim().max(500).optional(),
}).strict()

async function serializeRequests() {
  const requests = await db.roleChangeRequest.findMany({ take: 100, orderBy: { createdAt: 'desc' } })
  const ids = [...new Set(requests.flatMap((item) => [item.targetUserId, item.requestedById, item.reviewedById].filter(Boolean) as string[]))]
  const users = await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } })
  const byId = new Map(users.map((user) => [user.id, user]))
  return requests.map((item) => ({
    ...item,
    target: byId.get(item.targetUserId) ?? null,
    requestedBy: byId.get(item.requestedById) ?? null,
    reviewedBy: item.reviewedById ? byId.get(item.reviewedById) ?? null : null,
  }))
}

export async function GET() {
  const administrator = await getAuthenticatedUser()
  if (!administrator) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (administrator.role !== 'ADMIN') return NextResponse.json({ error: 'Accès administrateur requis' }, { status: 403 })
  return NextResponse.json({ requests: await serializeRequests(), isPlatformOwner: await isPlatformOwner(administrator.id) })
}

export async function POST(request: NextRequest) {
  try {
    const administrator = await getAuthenticatedUser()
    if (!administrator) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    if (administrator.role !== 'ADMIN') return NextResponse.json({ error: 'Accès administrateur requis' }, { status: 403 })

    const input = await readJsonBody(request, requestSchema)
    const target = await db.user.findUnique({ where: { id: input.targetUserId }, select: { id: true, name: true, email: true, role: true } })
    if (!target) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
    const owner = await isPlatformOwner(administrator.id)
    if (!canRequestRoleChange({ requesterIsPlatformOwner: owner, currentRole: target.role, requestedRole: input.requestedRole })) {
      const error = target.role === input.requestedRole
        ? 'Cet utilisateur possède déjà ce rôle'
        : 'Seul le propriétaire de la plateforme peut demander une promotion administrateur'
      return NextResponse.json({ error }, { status: 403 })
    }
    const pending = await db.roleChangeRequest.findFirst({ where: { targetUserId: target.id, status: 'PENDING' }, select: { id: true } })
    if (pending) return NextResponse.json({ error: 'Une demande de rôle est déjà en attente pour cet utilisateur' }, { status: 409 })

    const roleRequest = await db.$transaction(async (transaction) => {
      const created = await transaction.roleChangeRequest.create({ data: {
        targetUserId: target.id, requestedById: administrator.id, currentRole: target.role,
        requestedRole: input.requestedRole, reason: input.reason,
      } })
      await transaction.adminAuditLog.create({ data: {
        actorId: administrator.id, action: 'ROLE_CHANGE_REQUESTED', severity: 'WARNING', targetType: 'USER',
        targetId: target.id, targetLabel: target.name ?? target.email ?? target.id,
        summary: `Changement de rôle demandé : ${target.role} → ${input.requestedRole}`,
        metadata: { requestId: created.id, currentRole: target.role, requestedRole: input.requestedRole, reason: input.reason },
      } })
      await notifyAdministrators({
        type: 'ROLE_APPROVAL_REQUIRED', title: 'Approbation de rôle requise',
        message: `${target.name ?? target.email ?? target.id} : ${target.role} → ${input.requestedRole}`,
        linkView: 'admin', metadata: { requestId: created.id, targetUserId: target.id },
      }, [administrator.id, target.id], transaction)
      return created
    })
    return NextResponse.json({ request: roleRequest }, { status: 201 })
  } catch (error) {
    const requestError = apiRequestErrorResponse(error)
    if (requestError) return requestError
    console.error('POST /api/admin/role-requests error:', error)
    return NextResponse.json({ error: 'Impossible de créer la demande' }, { status: 500 })
  }
}
