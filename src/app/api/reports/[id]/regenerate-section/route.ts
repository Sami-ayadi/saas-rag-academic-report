import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'

import { apiRequestErrorResponse, readJsonBody } from '@/lib/api-input'
import { getAuthenticatedUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { applyReportVisibility, resolveEntitlements } from '@/lib/entitlements'
import { consumeQuota, QuotaExceededError, refundQuota, usagePeriod } from '@/lib/entitlements-server'
import { isLlmConfigured, reviseReportSection } from '@/lib/report-generation'
import type { ReportSection } from '@/lib/types'
import { retrieveRelevantSourceChunks, sourceChunksForPrompt } from '@/lib/source-retrieval'

export const runtime = 'nodejs'

const regenerateSectionSchema = z.object({
  sectionId: z.string().trim().min(1).max(100),
  instructions: z.string().trim().max(2_000).optional(),
}).strict()

// POST /api/reports/[id]/regenerate-section returns a draft; PATCH /api/reports/[id] accepts it.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getAuthenticatedUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié', code: 'UNAUTHENTICATED' }, { status: 401 })

    const report = await db.report.findFirst({
      where: { id, project: { userId: user.id } },
      include: { project: { include: { documents: { where: { role: 'PROJECT_EVIDENCE' }, select: { originalName: true } } } } },
    })
    if (!report) return NextResponse.json({ error: 'Rapport non trouvé', code: 'REPORT_NOT_FOUND' }, { status: 404 })

    const { sectionId, instructions } = await readJsonBody(request, regenerateSectionSchema)
    const sections = JSON.parse(report.sections) as ReportSection[]
    const targetSection = sections.find((section) => section.id === sectionId)
    if (!targetSection) return NextResponse.json({ error: 'Section non trouvée', code: 'SECTION_NOT_FOUND' }, { status: 404 })

    const entitlements = resolveEntitlements(user)
    const visible = applyReportVisibility({ sections, content: report.content }, entitlements)
    if (!visible.fullyVisibleSectionIds.includes(sectionId)) {
      return NextResponse.json({ error: 'Cette section n’est pas disponible dans l’aperçu de votre plan.', code: 'SECTION_NOT_AVAILABLE_IN_PREVIEW' }, { status: 402 })
    }
    if (!isLlmConfigured()) {
      return NextResponse.json({ error: 'Le service IA n’est pas configuré. Ajoutez LLM_API_KEY au serveur.', code: 'LLM_NOT_CONFIGURED' }, { status: 503 })
    }

    const period = usagePeriod()
    try {
      await consumeQuota(user.id, 'regeneration', entitlements.monthlyRegenerations, period)
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        return NextResponse.json({ error: 'Crédits de régénération épuisés pour ce mois.', code: 'REGENERATION_QUOTA_EXCEEDED' }, { status: 402 })
      }
      throw error
    }

    try {
      const sourceChunks = await retrieveRelevantSourceChunks(report.projectId, `${targetSection.title}\n${instructions ?? ''}\n${targetSection.content}`, 18)
      const generated = await reviseReportSection({
        title: report.project.title,
        brief: report.project.brief,
        academicLevel: report.project.academicLevel,
        university: report.project.university,
        field: report.project.field,
        language: report.project.language,
        sourceNames: report.project.documents.map((document) => document.originalName),
        sourceExcerpts: sourceChunksForPrompt(sourceChunks),
      }, targetSection, instructions)

      await db.apiUsage.create({
        data: {
          userId: user.id,
          projectId: report.projectId,
          type: 'section_regeneration',
          inputTokens: generated.inputTokens,
          outputTokens: generated.outputTokens,
          costUsd: generated.costUsd,
        },
      })
      return NextResponse.json({
        section: { ...targetSection, content: generated.content },
        originalContent: targetSection.content,
        message: 'Nouvelle version prête à vérifier',
      })
    } catch (error) {
      await refundQuota(user.id, 'regeneration', period)
      console.error('POST /api/reports/[id]/regenerate-section model error:', error)
      return NextResponse.json({ error: 'La révision IA a échoué. Réessayez plus tard.', code: 'LLM_GENERATION_FAILED' }, { status: 503 })
    }
  } catch (error) {
    const requestError = apiRequestErrorResponse(error)
    if (requestError) return requestError
    console.error('POST /api/reports/[id]/regenerate-section error:', error)
    return NextResponse.json({ error: 'Erreur lors de la régénération de la section', code: 'REGENERATION_FAILED' }, { status: 500 })
  }
}
