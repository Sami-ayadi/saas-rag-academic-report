import { NextRequest, NextResponse } from 'next/server'

import { getAuthenticatedUser } from '@/lib/auth'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const administrator = await getAuthenticatedUser()
  if (!administrator) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (administrator.role !== 'ADMIN') return NextResponse.json({ error: 'Accès administrateur requis' }, { status: 403 })

  const status = request.nextUrl.searchParams.get('status')
  const allowedStatuses = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'] as const
  const normalizedStatus = allowedStatuses.find((candidate) => candidate === status)
  const jobs = await db.generationJob.findMany({
    take: 100,
    orderBy: { updatedAt: 'desc' },
    where: normalizedStatus ? { status: normalizedStatus } : undefined,
    select: {
      id: true, type: true, status: true, progress: true, progressMessage: true, errorMessage: true,
      createdAt: true, updatedAt: true, startedAt: true, completedAt: true,
      user: { select: { name: true, email: true } },
      project: { select: { id: true, title: true } },
    },
  })

  return NextResponse.json({ jobs })
}
