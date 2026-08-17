import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'

import { apiRequestErrorResponse, readJsonBody } from '@/lib/api-input'
import { getAuthenticatedUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { createNotification } from '@/lib/notifications'

export const runtime = 'nodejs'

const updateUserSchema = z.object({
  tier: z.enum(['FREE', 'STARTER', 'PRO']).optional(),
  isActive: z.boolean().optional(),
  creditsLimit: z.number().int().min(0).max(100_000).optional(),
  reason: z.string().trim().max(500).optional(),
}).strict().refine(
  (value) => value.tier !== undefined || value.isActive !== undefined || value.creditsLimit !== undefined,
  'Aucune modification fournie',
)

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const administrator = await getAuthenticatedUser()
    if (!administrator) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    if (administrator.role !== 'ADMIN') return NextResponse.json({ error: 'Accès administrateur requis' }, { status: 403 })

    const { id } = await context.params
    const { reason, ...update } = await readJsonBody(request, updateUserSchema)
    if (id === administrator.id && update.isActive === false) {
      return NextResponse.json({ error: 'Vous ne pouvez pas retirer votre propre accès administrateur' }, { status: 400 })
    }

    const existing = await db.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, tier: true, role: true, isActive: true, creditsLimit: true },
    })
    if (!existing) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })

    const changedFields = Object.keys(update)
    const severity = update.isActive === false ? 'WARNING' : 'INFO'
    const user = await db.$transaction(async (transaction) => {
      const updatedUser = await transaction.user.update({
        where: { id },
        data: update,
        select: {
          id: true,
          email: true,
          name: true,
          tier: true,
          role: true,
          isActive: true,
          creditsUsed: true,
          creditsLimit: true,
        },
      })
      await transaction.adminAuditLog.create({
        data: {
          actorId: administrator.id,
          action: 'USER_UPDATED',
          severity,
          targetType: 'USER',
          targetId: id,
          targetLabel: existing.name ?? existing.email ?? id,
          summary: `Compte utilisateur modifié : ${changedFields.join(', ')}`,
          metadata: {
            changedFields,
            before: {
              tier: existing.tier,
              role: existing.role,
              isActive: existing.isActive,
              creditsLimit: existing.creditsLimit,
            },
            after: update,
            ...(reason ? { reason } : {}),
          },
        },
      })
      await createNotification({
        userId: id,
        type: 'ACCOUNT_UPDATED',
        title: 'Votre compte a été mis à jour',
        message: `Modification administrative : ${changedFields.join(', ')}${reason ? ` · ${reason}` : ''}`,
        linkView: 'settings',
        metadata: { changedFields },
      }, transaction)
      return updatedUser
    })
    return NextResponse.json({ user })
  } catch (error) {
    const requestError = apiRequestErrorResponse(error)
    if (requestError) return requestError
    console.error('PATCH /api/admin/users/[id] error:', error)
    return NextResponse.json({ error: 'Impossible de modifier cet utilisateur' }, { status: 500 })
  }
}
