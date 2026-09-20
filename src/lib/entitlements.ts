import type { Tier } from '@prisma/client'
import type { PricingTier, PricingTierLimits, ReportSection } from './types'

import { TIER_LABELS } from './billing'

// Re-export for consumers that want the single canonical source
export { TIER_LABELS }

export interface Entitlements {
  tier: Tier
  accountTier: string
  activeProjects: number
  documentsPerProject: number
  maxUploadBytes: number
  monthlyGenerationCredits: number
  monthlyRegenerations: number
  canExport: boolean
  canExportFormats: string[]
  exportFormats: string[]
  canEditReport: boolean
  showTableOfContents: boolean
  tableOfContents: boolean
  previewPageCount: number
  previewPages: number
}

const ENTITLEMENT_MATRIX: Record<Tier, Entitlements> = {
  FREE: {
    tier: 'FREE',
    accountTier: 'FREE',
    activeProjects: 1,
    documentsPerProject: 2,
    maxUploadBytes: 5_000_000,
    monthlyGenerationCredits: 3,
    monthlyRegenerations: 0,
    canExport: false,
    canExportFormats: [],
    exportFormats: [],
    canEditReport: true,
    showTableOfContents: true,
    tableOfContents: true,
    previewPageCount: 4,
    previewPages: 4,
  },
  STARTER: {
    tier: 'STARTER',
    accountTier: 'STARTER',
    activeProjects: 5,
    documentsPerProject: 10,
    maxUploadBytes: 25_000_000,
    monthlyGenerationCredits: 20,
    monthlyRegenerations: 5,
    canExport: true,
    canExportFormats: ['markdown', 'pdf', 'docx'],
    exportFormats: ['markdown', 'pdf', 'docx'],
    canEditReport: true,
    showTableOfContents: true,
    tableOfContents: true,
    previewPageCount: 0,
    previewPages: 0,
  },
  PRO: {
    tier: 'PRO',
    accountTier: 'PRO',
    activeProjects: 50,
    documentsPerProject: 50,
    maxUploadBytes: 100_000_000,
    monthlyGenerationCredits: 100,
    monthlyRegenerations: 20,
    canExport: true,
    canExportFormats: ['markdown', 'pdf', 'docx'],
    exportFormats: ['markdown', 'pdf', 'docx'],
    canEditReport: true,
    showTableOfContents: true,
    tableOfContents: true,
    previewPageCount: 0,
    previewPages: 0,
  },
}

export function resolveEntitlements(user: { tier: Tier }): Entitlements {
  return ENTITLEMENT_MATRIX[user.tier] ?? ENTITLEMENT_MATRIX.FREE
}

export function pricingTiers(): PricingTier[] {
  const limits: Record<Tier, PricingTierLimits> = {
    FREE: {
      projects: '1 projet',
      generations: '3 / mois',
      documents: '2 / projet',
      fileSize: '5 MB',
      exports: 'Non disponible',
      preview: 'Aperçu estimé à 4 pages',
    },
    STARTER: {
      projects: '5 projets',
      generations: '20 / mois',
      documents: '10 / projet',
      fileSize: '25 MB',
      exports: 'PDF, DOCX, MD',
      preview: 'Complet',
    },
    PRO: {
      projects: '50 projets',
      generations: '100 / mois',
      documents: '50 / projet',
      fileSize: '100 MB',
      exports: 'PDF, DOCX, MD',
      preview: 'Complet',
    },
  }

  return [
    {
      id: 'FREE',
      name: TIER_LABELS.FREE,
      price: 0,
      currency: 'EUR',
      period: 'par mois',
      credits: ENTITLEMENT_MATRIX.FREE.monthlyGenerationCredits,
      features: [
        '1 projet actif',
        '2 documents par projet',
        '3 générations par mois',
        'Aperçu estimé à 4 pages',
        'Plan et corrections manuelles',
      ],
      limits: limits.FREE,
    },
    {
      id: 'STARTER',
      name: TIER_LABELS.STARTER,
      price: 19,
      currency: 'EUR',
      period: 'par mois',
      credits: ENTITLEMENT_MATRIX.STARTER.monthlyGenerationCredits,
      features: [
        '5 projets actifs',
        '10 documents par projet',
        '20 générations par mois',
        '5 régénérations de sections',
        'Export PDF, DOCX, Markdown',
        'Édition du rapport',
      ],
      recommended: true,
      limits: limits.STARTER,
    },
    {
      id: 'PRO',
      name: TIER_LABELS.PRO,
      price: 49,
      currency: 'EUR',
      period: 'par mois',
      credits: ENTITLEMENT_MATRIX.PRO.monthlyGenerationCredits,
      features: [
        '50 projets actifs',
        '50 documents par projet',
        '100 générations par mois',
        '20 régénérations de sections',
        'Export PDF, DOCX, Markdown',
        'Édition du rapport',
        'Support prioritaire',
      ],
      limits: limits.PRO,
    },
  ]
}

export function canExport(entitlements: Entitlements, format: string): boolean {
  if (!entitlements.canExport) return false
  const normalized = format.toLowerCase() === 'md' ? 'markdown' : format.toLowerCase()
  return entitlements.canExportFormats.includes(normalized)
}

export function buildReportOutline(sections: unknown[]): { title: string; page: number }[] {
  if (!Array.isArray(sections)) return []
  return sections.map((section, index) => ({
    title: typeof section === 'object' && section !== null && 'title' in section
      ? String((section as { title: unknown }).title)
      : `Section ${index + 1}`,
    page: index + 1,
  }))
}

export function parseReportOutline(outlineJson: string | null): { title: string; page: number }[] {
  if (!outlineJson) return []
  try {
    const parsed = JSON.parse(outlineJson)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function parseSections(sectionsJson: string | null): ReportSection[] {
  if (!sectionsJson) return []
  try {
    const parsed = JSON.parse(sectionsJson)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export interface VisibleReport {
  sections: ReportSection[]
  content: string | null
  fullyVisibleSectionIds: string[]
  access: 'full' | 'preview' | 'none'
}

export function applyReportVisibility(
  report: { sections: ReportSection[]; content: string | null },
  entitlements: Entitlements,
): VisibleReport {
  if (entitlements.previewPageCount === 0) {
    return {
      sections: report.sections,
      content: report.content,
      fullyVisibleSectionIds: report.sections.map((section) => section.id),
      access: 'full',
    }
  }

  // Build the preview from approved section bodies. The stored full-content
  // string includes locked titles and must never be sent to a FREE account.
  let wordsRemaining = entitlements.previewPageCount * 280
  const visibleSections: ReportSection[] = []
  const fullyVisibleSectionIds: string[] = []
  for (const section of report.sections) {
    if (wordsRemaining <= 0) break
    const words = section.content.match(/\S+\s*/g) ?? []
    const fullyVisible = words.length <= wordsRemaining
    visibleSections.push({
      ...section,
      content: fullyVisible ? section.content : words.slice(0, wordsRemaining).join('').trimEnd(),
    })
    if (fullyVisible) fullyVisibleSectionIds.push(section.id)
    wordsRemaining -= Math.min(words.length, wordsRemaining)
  }
  const isFull = fullyVisibleSectionIds.length === report.sections.length

  return {
    sections: visibleSections,
    content: visibleSections.map((section) => `# ${section.title}\n\n${section.content}`).join('\n\n---\n\n'),
    fullyVisibleSectionIds,
    access: isFull ? 'full' : 'preview',
  }
}
