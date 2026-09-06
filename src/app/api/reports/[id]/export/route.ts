import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'

import { db } from '@/lib/db'
import { getAuthenticatedUser } from '@/lib/auth'
import { apiRequestErrorResponse, readJsonBody } from '@/lib/api-input'
import { canExport, resolveEntitlements } from '@/lib/entitlements'
import { createReportExport } from '@/lib/report-export'
import type { ReportSection } from '@/lib/types'

export const runtime = 'nodejs'

const exportSchema = z.object({
  format: z.enum(['docx', 'pdf', 'md']),
}).strict()

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const user = await getAuthenticatedUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const report = await db.report.findFirst({
      where: { id, project: { userId: user.id } },
      include: { project: true },
    })
    if (!report) return NextResponse.json({ error: 'Rapport non trouvé' }, { status: 404 })

    const { format } = await readJsonBody(request, exportSchema)

    // Export is a paid entitlement. The check happens before any artefact is
    // produced and never trusts a tier sent by the browser.
    const entitlements = resolveEntitlements(user)
    if (!canExport(entitlements, format)) {
      return NextResponse.json(
        { error: 'L’export du rapport est réservé aux plans payants.', code: 'EXPORT_NOT_ENTITLED' },
        { status: 402 },
      )
    }

    let sections: ReportSection[]
    try {
      const parsed = JSON.parse(report.sections) as ReportSection[]
      sections = Array.isArray(parsed) && parsed.length
        ? parsed
        : [{ id: 'report', title: report.title, content: report.content, status: 'completed', order: 0 }]
    } catch {
      sections = [{ id: 'report', title: report.title, content: report.content, status: 'completed', order: 0 }]
    }

    const exported = await createReportExport({
      title: report.title,
      content: report.content,
      sections,
      project: report.project,
    }, format)
    await db.project.update({ where: { id: report.projectId }, data: { status: 'EXPORTED' } })

    return new NextResponse(new Uint8Array(exported.bytes), {
      status: 200,
      headers: {
        'Content-Type': exported.contentType,
        'Content-Disposition': `attachment; filename="${exported.filename}"`,
        'Content-Length': String(exported.bytes.byteLength),
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    console.error('POST /api/reports/[id]/export error:', error)
    const requestError = apiRequestErrorResponse(error)
    if (requestError) return requestError
    return NextResponse.json({ error: 'Erreur lors de l’export du rapport' }, { status: 500 })
  }
}
