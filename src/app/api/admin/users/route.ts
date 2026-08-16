import { NextRequest, NextResponse } from 'next/server'

import { getAuthenticatedUser } from '@/lib/auth'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const administrator = await getAuthenticatedUser()
  if (!administrator) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (administrator.role !== 'ADMIN') return NextResponse.json({ error: 'Accès administrateur requis' }, { status: 403 })

  const search = request.nextUrl.searchParams.get('search')?.trim().slice(0, 100)
  const users = await db.user.findMany({
    take: 100,
    orderBy: { createdAt: 'desc' },
    where: search
      ? { OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ] }
      : undefined,
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      tier: true,
      role: true,
      isActive: true,
      creditsUsed: true,
      creditsLimit: true,
      createdAt: true,
      _count: { select: { projects: true, jobs: true } },
    },
  })

  const reportCounts = await Promise.all(users.map((user) => db.report.count({
    where: { project: { userId: user.id } },
  })))

  return NextResponse.json({
    users: users.map((user, index) => ({ ...user, reportCount: reportCounts[index] })),
    currentUserId: administrator.id,
  })
}
