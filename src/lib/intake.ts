import { z } from 'zod/v4'

const shortText = z.string().trim().min(1).max(300)
const optionalShortText = z.string().trim().max(300).optional().default('')
const longText = z.string().trim().min(20).max(4000)
const optionalLongText = z.string().trim().max(3000).optional().default('')

export const disciplineContextSchema = z.object({
  specialization: optionalShortText,
  countryOrJurisdiction: optionalShortText,
  medicalSpecialty: optionalShortText,
  technicalEnvironment: z.string().trim().max(1000).optional().default(''),
  applicableStandards: z.string().trim().max(1000).optional().default(''),
}).strict()

export const intakeAnswersSchema = z.object({
  organization: shortText,
  industry: shortText,
  role: shortText,
  internshipPeriod: optionalShortText,
  missionSummary: longText,
  problemStatement: longText,
  objectives: z.array(shortText).min(1).max(6),
  methodsAndTools: z.array(shortText).max(20).default([]),
  results: optionalLongText,
  constraints: optionalLongText,
  universityRequirements: optionalLongText,
  confidentialityNotes: z.string().trim().max(1000).optional().default(''),
  disciplineContext: disciplineContextSchema,
}).strict()

export type IntakeAnswers = z.infer<typeof intakeAnswersSchema>

export const draftIntakeAnswersSchema = z.object({
  organization: z.string().trim().max(300).optional(),
  industry: z.string().trim().max(300).optional(),
  role: z.string().trim().max(300).optional(),
  internshipPeriod: z.string().trim().max(300).optional(),
  missionSummary: z.string().trim().max(4000).optional(),
  problemStatement: z.string().trim().max(4000).optional(),
  objectives: z.array(z.string().trim().max(300)).max(6).optional(),
  methodsAndTools: z.array(z.string().trim().max(300)).max(20).optional(),
  results: z.string().trim().max(3000).optional(),
  constraints: z.string().trim().max(3000).optional(),
  universityRequirements: z.string().trim().max(3000).optional(),
  confidentialityNotes: z.string().trim().max(1000).optional(),
  disciplineContext: disciplineContextSchema.partial().optional(),
}).strict()

export const saveIntakeSchema = z.object({
  currentStep: z.number().int().min(1).max(5),
  answers: draftIntakeAnswersSchema,
}).strict()

const INJECTION_PATTERNS: Array<{ code: string; pattern: RegExp }> = [
  { code: 'IGNORE_INSTRUCTIONS', pattern: /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/i },
  { code: 'SYSTEM_PROMPT_REQUEST', pattern: /(reveal|show|print|repeat).{0,30}(system|developer)\s+(prompt|message|instructions?)/i },
  { code: 'ROLE_OVERRIDE', pattern: /(you are now|act as|switch role|developer message|system message)/i },
  { code: 'PROMPT_BOUNDARY_TOKEN', pattern: /<\|(?:system|assistant|developer|endoftext)[^>]*\|>/i },
  { code: 'JAILBREAK_LANGUAGE', pattern: /(jailbreak|do anything now|bypass.{0,20}(safety|policy|instructions?))/i },
]

function collectStrings(value: unknown, path = 'answers'): Array<{ path: string; value: string }> {
  if (typeof value === 'string') return [{ path, value }]
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectStrings(item, `${path}[${index}]`))
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) => collectStrings(child, `${path}.${key}`))
  }
  return []
}

export interface IntakeRiskFlag {
  field: string
  code: string
}

export function assessIntakeRisk(answers: unknown): IntakeRiskFlag[] {
  const flags: IntakeRiskFlag[] = []

  for (const entry of collectStrings(answers)) {
    for (const candidate of INJECTION_PATTERNS) {
      if (candidate.pattern.test(entry.value)) {
        flags.push({ field: entry.path, code: candidate.code })
      }
    }
  }

  return flags
}

export interface ProjectBriefInput {
  title: string
  field: string | null
  academicLevel: string
  university: string | null
  language: string
}

export function buildProjectBrief(project: ProjectBriefInput, answers: IntakeAnswers) {
  return {
    schemaVersion: 1,
    title: project.title,
    discipline: project.field ?? 'Non précisé',
    specialization: answers.disciplineContext.specialization,
    academicLevel: project.academicLevel,
    university: project.university,
    language: project.language,
    internship: {
      organization: answers.organization,
      industry: answers.industry,
      role: answers.role,
      period: answers.internshipPeriod,
    },
    subject: {
      mission: answers.missionSummary,
      problemStatement: answers.problemStatement,
      objectives: answers.objectives,
      methodsAndTools: answers.methodsAndTools,
      results: answers.results,
      constraints: answers.constraints,
    },
    disciplineContext: answers.disciplineContext,
    academicRequirements: answers.universityRequirements,
    confidentiality: answers.confidentialityNotes,
    provenance: {
      source: 'USER_QUESTIONNAIRE',
      factualClaimsRequireUserReview: true,
    },
  }
}
