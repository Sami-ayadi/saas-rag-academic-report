import { NextResponse } from 'next/server'

import { getAuthenticatedUser } from '@/lib/auth'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const administrator = await getAuthenticatedUser()
  if (!administrator) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (administrator.role !== 'ADMIN') return NextResponse.json({ error: 'Accès administrateur requis' }, { status: 403 })

  const { id } = await context.params
  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, createdAt: true },
  })
  if (!user) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })

  const projects = await db.project.findMany({
    where: { userId: id },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true, title: true, status: true, academicLevel: true, field: true, createdAt: true, updatedAt: true,
      _count: { select: { documents: true, reports: true, jobs: true } },
    },
  })

  return NextResponse.json({ user, projects })
}
