import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { z } from 'zod/v4'

import { getAuthenticatedUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { assessIntakeRisk, buildProjectBrief, intakeAnswersSchema, saveIntakeSchema } from '@/lib/intake'
import { apiRequestErrorResponse, readJsonBody } from '@/lib/api-input'

export const runtime = 'nodejs'

async function findOwnedProject(id: string, userId: string) {
  return db.project.findFirst({
    where: { id, userId },
    select: {
      id: true,
      title: true,
      field: true,
      academicLevel: true,
      university: true,
      language: true,
    },
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const user = await getAuthenticatedUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const project = await findOwnedProject(id, user.id)
    if (!project) return NextResponse.json({ error: 'Projet non trouvé' }, { status: 404 })

    const intake = await db.projectIntake.findUnique({
      where: { projectId: id },
      include: { briefs: { orderBy: { version: 'desc' }, take: 1 } },
    })

    return NextResponse.json({ intake })
  } catch (error) {
    console.error('GET /api/projects/[id]/intake error:', error)
    return NextResponse.json({ error: 'Erreur lors du chargement du questionnaire' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const user = await getAuthenticatedUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const project = await findOwnedProject(id, user.id)
    if (!project) return NextResponse.json({ error: 'Projet non trouvé' }, { status: 404 })

    const payload = await readJsonBody(request, saveIntakeSchema)
    const riskFlags = assessIntakeRisk(payload.answers)
    const riskFlagsJson: Prisma.InputJsonArray = riskFlags.map(({ field, code }) => ({ field, code }))
    const completeAnswers = intakeAnswersSchema.safeParse(payload.answers)
    const status = riskFlags.length === 0 && payload.currentStep === 5 && completeAnswers.success
      ? 'READY_FOR_REVIEW'
      : 'IN_PROGRESS'

    const intake = await db.projectIntake.upsert({
      where: { projectId: id },
      create: {
        projectId: id,
        currentStep: payload.currentStep,
        status,
        answers: payload.answers as Prisma.InputJsonValue,
        riskFlags: riskFlagsJson,
      },
      update: {
        currentStep: payload.currentStep,
        status,
        answers: payload.answers as Prisma.InputJsonValue,
        riskFlags: riskFlagsJson,
        approvedAt: null,
      },
    })

    if (riskFlags.length > 0) {
      return NextResponse.json(
        {
          error: 'Certaines réponses ressemblent à des instructions destinées à contourner le système.',
          riskFlags,
          intake,
        },
        { status: 422 },
      )
    }

    return NextResponse.json({
      intake,
      complete: completeAnswers.success,
      validationIssues: completeAnswers.success ? [] : completeAnswers.error.issues,
    })
  } catch (error) {
    console.error('PUT /api/projects/[id]/intake error:', error)
    const requestError = apiRequestErrorResponse(error)
    if (requestError) return requestError
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Réponses invalides', details: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erreur lors de la sauvegarde du questionnaire' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const user = await getAuthenticatedUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const project = await findOwnedProject(id, user.id)
    if (!project) return NextResponse.json({ error: 'Projet non trouvé' }, { status: 404 })

    const intake = await db.projectIntake.findUnique({ where: { projectId: id } })
    if (!intake) return NextResponse.json({ error: 'Questionnaire introuvable' }, { status: 404 })

    const answers = intakeAnswersSchema.parse(intake.answers)
    const riskFlags = assessIntakeRisk(answers)
    if (riskFlags.length > 0) {
      return NextResponse.json({ error: 'Le questionnaire doit être corrigé avant validation', riskFlags }, { status: 422 })
    }

    const latestBrief = await db.projectBrief.findFirst({
      where: { projectId: id },
      orderBy: { version: 'desc' },
      select: { version: true },
    })
    const version = (latestBrief?.version ?? 0) + 1
    const content = buildProjectBrief(project, answers)

    const [, brief] = await db.$transaction([
      db.projectIntake.update({
        where: { id: intake.id },
        data: { status: 'APPROVED', approvedAt: new Date(), riskFlags: [] },
      }),
      db.projectBrief.create({
        data: {
          projectId: id,
          intakeId: intake.id,
          version,
          content: content as Prisma.InputJsonValue,
        },
      }),
    ])

    return NextResponse.json({ brief }, { status: 201 })
  } catch (error) {
    console.error('POST /api/projects/[id]/intake error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Questionnaire incomplet', details: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erreur lors de la validation du brief' }, { status: 500 })
  }
}
