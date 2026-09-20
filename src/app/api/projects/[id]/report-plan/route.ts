import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { z } from 'zod/v4'

import { apiRequestErrorResponse, readJsonBody } from '@/lib/api-input'
import { getAuthenticatedUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { generateReportOutline, isLlmConfigured, parseReportOutline } from '@/lib/report-generation'
import { retrieveRelevantSourceChunks, sourceChunksForPrompt } from '@/lib/source-retrieval'

export const runtime = 'nodejs'
export const maxDuration = 120

const templateSchema = z.enum(['software-classic-v1', 'security-audit-v1'])
const createPlanSchema = z.object({
  templateKey: templateSchema,
  targetPages: z.number().int().min(10).max(120).default(50),
}).strict()

const updatePlanSchema = z.object({
  planId: z.string().min(1).max(100),
  action: z.enum(['save', 'approve']),
  content: z.unknown().optional(),
}).strict()

async function ownedProject(projectId: string, userId: string) {
  return db.project.findFirst({
    where: { id: projectId, userId },
    include: {
      documents: { where: { role: 'PROJECT_EVIDENCE' } },
      summaries: { orderBy: { version: 'desc' }, take: 1 },
      briefs: { where: { status: 'APPROVED' }, orderBy: { version: 'desc' }, take: 1 },
    },
  })
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const project = await db.project.findFirst({ where: { id, userId: user.id }, select: { id: true } })
  if (!project) return NextResponse.json({ error: 'Projet non trouvé' }, { status: 404 })
  const plan = await db.reportPlan.findFirst({ where: { projectId: id }, orderBy: { version: 'desc' } })
  return NextResponse.json({ plan })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getAuthenticatedUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    if (!isLlmConfigured()) {
      return NextResponse.json({ error: 'Le service IA n’est pas configuré.', code: 'LLM_NOT_CONFIGURED' }, { status: 503 })
    }
    const payload = await readJsonBody(request, createPlanSchema)
    const project = await ownedProject(id, user.id)
    if (!project) return NextResponse.json({ error: 'Projet non trouvé' }, { status: 404 })
    const brief = project.briefs[0]
    if (!brief) {
      return NextResponse.json({
        error: 'Validez le questionnaire et le brief avant de préparer le plan.',
        code: 'APPROVED_BRIEF_REQUIRED',
      }, { status: 409 })
    }

    const query = `${project.title}\n${project.brief ?? ''}\n${JSON.stringify(brief.content)}`
    const sources = await retrieveRelevantSourceChunks(id, query, 20)
    const generationProject = {
      title: project.title,
      brief: project.brief,
      academicLevel: project.academicLevel,
      university: project.university,
      field: project.field,
      language: project.language,
      sourceNames: project.documents.map((document) => document.originalName),
      sourceExcerpts: sourceChunksForPrompt(sources),
      structuredBrief: brief.content,
      reportTemplate: payload.templateKey,
    } as const
    const summary = project.summaries[0]?.content ?? JSON.stringify(brief.content)
    const content = await generateReportOutline(generationProject, summary, payload.targetPages)
    const latest = await db.reportPlan.findFirst({
      where: { projectId: id },
      orderBy: { version: 'desc' },
      select: { version: true },
    })
    const plan = await db.$transaction(async (transaction) => {
      await transaction.reportPlan.updateMany({
        where: { projectId: id, status: 'DRAFT' },
        data: { status: 'SUPERSEDED' },
      })
      return transaction.reportPlan.create({
        data: {
          projectId: id,
          briefId: brief.id,
          version: (latest?.version ?? 0) + 1,
          templateKey: payload.templateKey,
          content: content as unknown as Prisma.InputJsonValue,
        },
      })
    })
    return NextResponse.json({ plan }, { status: 201 })
  } catch (error) {
    console.error('POST /api/projects/[id]/report-plan error:', error)
    const requestError = apiRequestErrorResponse(error)
    if (requestError) return requestError
    return NextResponse.json({ error: 'Impossible de préparer le plan du rapport.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getAuthenticatedUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    const payload = await readJsonBody(request, updatePlanSchema, 150_000)
    const existing = await db.reportPlan.findFirst({
      where: { id: payload.planId, projectId: id, project: { userId: user.id } },
    })
    if (!existing) return NextResponse.json({ error: 'Plan non trouvé' }, { status: 404 })
    if (existing.status !== 'DRAFT') {
      return NextResponse.json({ error: 'Ce plan est déjà figé. Préparez une nouvelle version pour le modifier.' }, { status: 409 })
    }
    const content = payload.content === undefined ? parseReportOutline(existing.content) : parseReportOutline(payload.content)
    if (!content) {
      return NextResponse.json({ error: 'Structure du plan invalide.', code: 'INVALID_REPORT_PLAN' }, { status: 422 })
    }
    const ordered = [...content.sections].sort((left, right) => left.order - right.order)
    if (ordered.some((section, index) => section.order !== index)) {
      return NextResponse.json({ error: 'L’ordre des sections doit être continu et commencer à zéro.' }, { status: 422 })
    }
    if (payload.action === 'save') {
      const plan = await db.reportPlan.update({
        where: { id: existing.id },
        data: { content: content as unknown as Prisma.InputJsonValue },
      })
      return NextResponse.json({ plan })
    }
    const [, plan] = await db.$transaction([
      db.reportPlan.updateMany({
        where: { projectId: id, id: { not: existing.id }, status: 'APPROVED' },
        data: { status: 'SUPERSEDED', approvedAt: null },
      }),
      db.reportPlan.update({
        where: { id: existing.id },
        data: { content: content as unknown as Prisma.InputJsonValue, status: 'APPROVED', approvedAt: new Date() },
      }),
      db.project.update({ where: { id }, data: { status: 'OUTLINE_APPROVED' } }),
    ])
    return NextResponse.json({ plan })
  } catch (error) {
    console.error('PATCH /api/projects/[id]/report-plan error:', error)
    const requestError = apiRequestErrorResponse(error)
    if (requestError) return requestError
    return NextResponse.json({ error: 'Impossible de mettre à jour le plan.' }, { status: 500 })
  }
}

