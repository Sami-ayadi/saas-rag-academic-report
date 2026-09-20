import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'

import { getAuthenticatedUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { assessReportQuality } from '@/lib/report-quality'
import type { ReportSection } from '@/lib/types'

export const runtime = 'nodejs'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getAuthenticatedUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    const report = await db.report.findFirst({ where: { id, project: { userId: user.id } } })
    if (!report) return NextResponse.json({ error: 'Rapport non trouvé' }, { status: 404 })

    let sections: ReportSection[] = []
    try {
      const parsed = JSON.parse(report.sections) as unknown
      if (Array.isArray(parsed)) sections = parsed as ReportSection[]
    } catch {
      return NextResponse.json({ error: 'Le rapport contient une structure invalide.' }, { status: 422 })
    }
    const issues = assessReportQuality(sections)
    const blocking = issues.filter((issue) => issue.severity === 'blocking')
    if (blocking.length > 0) {
      await db.report.update({ where: { id }, data: { qualityIssues: issues as unknown as Prisma.InputJsonValue, status: 'REVIEW_REQUIRED', approvedAt: null } })
      return NextResponse.json({
        error: 'Corrigez les points bloquants avant de valider le rapport.',
        code: 'QUALITY_REVIEW_REQUIRED',
        issues,
      }, { status: 422 })
    }

    const approvedAt = new Date()
    const [, approved] = await db.$transaction([
      db.project.update({ where: { id: report.projectId }, data: { status: 'APPROVED' } }),
      db.report.update({ where: { id }, data: { status: 'APPROVED', approvedAt, qualityIssues: issues as unknown as Prisma.InputJsonValue } }),
    ])
    return NextResponse.json({ report: approved, issues })
  } catch (error) {
    console.error('POST /api/reports/[id]/approve error:', error)
    return NextResponse.json({ error: 'Impossible de valider le rapport.' }, { status: 500 })
  }
}
