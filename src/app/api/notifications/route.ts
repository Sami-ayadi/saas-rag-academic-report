import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'

import { getAuthenticatedUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { apiRequestErrorResponse, readJsonBody } from '@/lib/api-input'

export const runtime = 'nodejs'

const markReadSchema = z.object({
  ids: z.array(z.string().min(1).max(100)).max(50).optional(),
  all: z.boolean().optional(),
}).strict()

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const requestedPage = Number(request.nextUrl.searchParams.get('page') ?? 1)
  const requestedPageSize = Number(request.nextUrl.searchParams.get('pageSize') ?? 10)
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const pageSize = Number.isInteger(requestedPageSize) ? Math.min(Math.max(requestedPageSize, 1), 50) : 10
  const where = { userId: user.id, readAt: null }
  const [notifications, total] = await Promise.all([
    db.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    db.notification.count({ where }),
  ])
  return NextResponse.json({ notifications, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } })
}

export async function PATCH(request: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  let body: z.infer<typeof markReadSchema>
  try {
    body = await readJsonBody(request, markReadSchema, 8_000)
  } catch (error) {
    return apiRequestErrorResponse(error) ?? NextResponse.json({ error: 'Données invalides', code: 'INVALID_INPUT' }, { status: 400 })
  }
  if (body.all === true) {
    const result = await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } })
    return NextResponse.json({ updated: result.count })
  }
  const ids = body.ids ?? []
  if (ids.length === 0) return NextResponse.json({ updated: 0 })
  const result = await db.notification.updateMany({ where: { id: { in: ids }, userId: user.id, readAt: null }, data: { readAt: new Date() } })
  return NextResponse.json({ updated: result.count })
}
