import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'

import { apiRequestErrorResponse, readJsonBody } from '@/lib/api-input'
import { getAuthenticatedUser } from '@/lib/auth'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

const updateUserSchema = z.object({
  tier: z.enum(['FREE', 'STARTER', 'PRO']).optional(),
  role: z.enum(['USER', 'ADMIN']).optional(),
  isActive: z.boolean().optional(),
  creditsLimit: z.number().int().min(0).max(100_000).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'Aucune modification fournie')

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const administrator = await getAuthenticatedUser()
    if (!administrator) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    if (administrator.role !== 'ADMIN') return NextResponse.json({ error: 'Accès administrateur requis' }, { status: 403 })

    const { id } = await context.params
    const update = await readJsonBody(request, updateUserSchema)
    if (id === administrator.id && (update.role === 'USER' || update.isActive === false)) {
      return NextResponse.json({ error: 'Vous ne pouvez pas retirer votre propre accès administrateur' }, { status: 400 })
    }

    const existing = await db.user.findUnique({ where: { id }, select: { id: true } })
    if (!existing) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })

    const user = await db.user.update({
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
    return NextResponse.json({ user })
  } catch (error) {
    const requestError = apiRequestErrorResponse(error)
    if (requestError) return requestError
    console.error('PATCH /api/admin/users/[id] error:', error)
    return NextResponse.json({ error: 'Impossible de modifier cet utilisateur' }, { status: 500 })
  }
}
