import { NextResponse } from 'next/server'

import { getAuthenticatedUser } from '@/lib/auth'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET() {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Accès administrateur requis' }, { status: 403 })

  const [users, projects, reports, documents, usage, recentProjects] = await Promise.all([
    db.user.count(),
    db.project.count(),
    db.report.count(),
    db.document.count(),
    db.apiUsage.aggregate({
      _sum: { costUsd: true, inputTokens: true, outputTokens: true },
    }),
    db.project.findMany({
      take: 8,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        status: true,
        updatedAt: true,
        user: { select: { name: true, email: true } },
        _count: { select: { documents: true, reports: true } },
      },
    }),
  ])

  return NextResponse.json({
    stats: {
      users,
      projects,
      reports,
      documents,
      costUsd: usage._sum.costUsd ?? 0,
      tokens: (usage._sum.inputTokens ?? 0) + (usage._sum.outputTokens ?? 0),
    },
    recentProjects,
  })
}
