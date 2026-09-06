import type { PricingTier, ReportSection } from './types'

/**
 * Canonical, server-owned plan definition.
 *
 * Every price, quota, export permission and preview rule lives here. Routes must
 * resolve entitlements from the persisted user record — never from a tier sent by
 * the browser. This module is intentionally pure (no database, no environment) so
 * that both the public pricing page and the API can render the same numbers.
 */

export type TierId = 'FREE' | 'STARTER' | 'PRO'
export type ExportFormat = 'md' | 'docx' | 'pdf'
export type QuotaKind = 'generation' | 'regeneration'

export const TIER_IDS = ['FREE', 'STARTER', 'PRO'] as const

/** Approximate characters rendered on one A4 page of an academic report. */
export const PREVIEW_CHARACTERS_PER_PAGE = 1_800

export const PREVIEW_NOTICE =
  '\n\n> _Aperçu limité à votre plan actuel. Le reste du rapport et le plan détaillé sont réservés aux plans payants._'

export interface TierLimits {
  /** Summary + report generations allowed per calendar month (UTC). */
  monthlyGenerationCredits: number
  /** Section regenerations allowed per calendar month (UTC). */
  monthlyRegenerations: number
  activeProjects: number
  documentsPerProject: number
  maxUploadBytes: number
  exportFormats: readonly ExportFormat[]
  /** `null` means the whole report is readable; a number caps the readable preview. */
  previewPages: number | null
  /** Whether the stored outline / table of contents may leave the server. */
  tableOfContents: boolean
  watermark: boolean
  /** Preview-limited tiers may not edit report content, so a truncated body is never saved back. */
  canEditReport: boolean
}

export interface TierDefinition {
  tier: TierId
  publicId: string
  name: string
  tagline: string
  price: number
  currency: string
  period: string
  recommended: boolean
  limits: TierLimits
  features: string[]
}

const MEGABYTE = 1024 * 1024

export const TIERS: Record<TierId, TierDefinition> = {
  FREE: {
    tier: 'FREE',
    publicId: 'free',
    name: 'Gratuit',
    tagline: 'Tester le cadrage et obtenir un aperçu de 4 pages.',
    price: 0,
    currency: '€',
    period: 'pour toujours',
    recommended: false,
    limits: {
      monthlyGenerationCredits: 3,
      // Regeneration stays possible but only on sections already readable in the
      // preview, so it cannot be used to page through the protected report.
      monthlyRegenerations: 2,
      activeProjects: 1,
      documentsPerProject: 5,
      maxUploadBytes: 5 * MEGABYTE,
      exportFormats: [],
      previewPages: 4,
      tableOfContents: false,
      watermark: true,
      canEditReport: false,
    },
    features: [
      '3 générations par mois',
      'Synthèse bibliographique automatique',
      '1 projet actif',
      'Aperçu de 4 pages',
      'Plan détaillé protégé',
    ],
  },
  STARTER: {
    tier: 'STARTER',
    publicId: 'starter',
    name: 'Étudiant',
    tagline: 'Construire et finaliser un rapport complet.',
    price: 19,
    currency: '€',
    period: 'par mois',
    recommended: true,
    limits: {
      monthlyGenerationCredits: 15,
      monthlyRegenerations: 20,
      activeProjects: 5,
      documentsPerProject: 50,
      maxUploadBytes: 25 * MEGABYTE,
      exportFormats: ['md', 'docx', 'pdf'],
      previewPages: null,
      tableOfContents: true,
      watermark: false,
      canEditReport: true,
    },
    features: [
      '15 générations par mois',
      'Rapport complet et plan détaillé',
      '20 régénérations de section par mois',
      'Exports PDF, DOCX et Markdown',
      '5 projets actifs',
      'Support prioritaire',
    ],
  },
  PRO: {
    tier: 'PRO',
    publicId: 'pro',
    name: 'Pro',
    tagline: 'Pour les usages intensifs et les modèles personnalisés.',
    price: 49,
    currency: '€',
    period: 'par mois',
    recommended: false,
    limits: {
      monthlyGenerationCredits: 50,
      monthlyRegenerations: 200,
      activeProjects: 200,
      documentsPerProject: 200,
      maxUploadBytes: 100 * MEGABYTE,
      exportFormats: ['md', 'docx', 'pdf'],
      previewPages: null,
      tableOfContents: true,
      watermark: false,
      canEditReport: true,
    },
    features: [
      '50 générations par mois',
      'Rapport complet et plan détaillé',
      '200 régénérations de section par mois',
      'Exports PDF, DOCX et Markdown',
      'Projets étendus',
      'Génération prioritaire',
      'Support dédié',
    ],
  },
}

export interface Entitlements extends TierLimits {
  /** Tier actually applied on the server (administrators are served PRO). */
  tier: TierId
  /** Tier stored on the account, before the administrator override. */
  accountTier: TierId
}

export interface EntitlementSubject {
  tier: TierId
  role: 'USER' | 'ADMIN'
  /** Per-account credit override maintained by administrators. */
  creditsLimit?: number | null
}

/**
 * Resolve the effective server-side permissions of a persisted account.
 * Administrators always receive the highest tier so support work is never blocked.
 */
export function resolveEntitlements(subject: EntitlementSubject): Entitlements {
  const accountTier: TierId = TIER_IDS.includes(subject.tier) ? subject.tier : 'FREE'
  const effectiveTier: TierId = subject.role === 'ADMIN' ? 'PRO' : accountTier
  const definition = TIERS[effectiveTier]

  const override = subject.creditsLimit
  const monthlyGenerationCredits = Number.isInteger(override) && (override as number) >= 0
    ? (override as number)
    : definition.limits.monthlyGenerationCredits

  return {
    ...definition.limits,
    monthlyGenerationCredits,
    tier: effectiveTier,
    accountTier,
  }
}

export function quotaLimit(entitlements: Entitlements, kind: QuotaKind) {
  return kind === 'generation'
    ? entitlements.monthlyGenerationCredits
    : entitlements.monthlyRegenerations
}

export function canExport(entitlements: Entitlements, format: ExportFormat) {
  return entitlements.exportFormats.includes(format)
}

// ==================== Protected outline ====================

export interface OutlineEntry {
  id: string
  title: string
  headings: string[]
}

/**
 * Build the outline that is stored privately with the report. It is only ever
 * returned to tiers whose `tableOfContents` entitlement is enabled.
 */
export function buildReportOutline(sections: ReportSection[]): OutlineEntry[] {
  return [...sections]
    .sort((left, right) => left.order - right.order)
    .map((section) => ({
      id: section.id,
      title: section.title,
      headings: section.content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => /^#{2,4}\s+/.test(line))
        .map((line) => line.replace(/^#{2,4}\s+/, ''))
        .slice(0, 40),
    }))
}

export function parseReportOutline(raw: string): OutlineEntry[] {
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as OutlineEntry[]) : []
  } catch {
    return []
  }
}

// ==================== Protected preview ====================

export interface ReportAccess {
  tier: TierId
  previewApplied: boolean
  previewPages: number | null
  visibleSections: number
  /** Count only — locked titles would leak the protected outline. */
  lockedSections: number
  tableOfContents: boolean
  exportFormats: ExportFormat[]
  canEditReport: boolean
  watermark: boolean
}

export interface VisibleReport {
  sections: ReportSection[]
  content: string
  /** Sections returned in full; the only ones a preview-limited tier may regenerate. */
  fullyVisibleSectionIds: string[]
  access: ReportAccess
}

function joinSections(sections: ReportSection[]) {
  return sections.map((section) => `# ${section.title}\n\n${section.content}`).join('\n\n---\n\n')
}

function truncateAtWordBoundary(content: string, budget: number) {
  const slice = content.slice(0, budget)
  const lastBreak = slice.lastIndexOf(' ')
  return (lastBreak > budget * 0.6 ? slice.slice(0, lastBreak) : slice).trimEnd()
}

/**
 * Reduce a stored report to what the tier is allowed to read. Locked sections are
 * dropped entirely (titles included) so the response never discloses the outline.
 */
export function applyReportVisibility(
  report: { sections: ReportSection[]; content: string },
  entitlements: Entitlements,
): VisibleReport {
  const ordered = [...report.sections].sort((left, right) => left.order - right.order)
  const baseAccess = {
    tier: entitlements.tier,
    previewPages: entitlements.previewPages,
    tableOfContents: entitlements.tableOfContents,
    exportFormats: [...entitlements.exportFormats],
    canEditReport: entitlements.canEditReport,
    watermark: entitlements.watermark,
  }

  if (entitlements.previewPages === null) {
    return {
      sections: ordered,
      content: report.content,
      fullyVisibleSectionIds: ordered.map((section) => section.id),
      access: {
        ...baseAccess,
        previewApplied: false,
        visibleSections: ordered.length,
        lockedSections: 0,
      },
    }
  }

  let remaining = Math.max(0, entitlements.previewPages) * PREVIEW_CHARACTERS_PER_PAGE
  const visible: ReportSection[] = []
  const fullyVisibleSectionIds: string[] = []
  let lockedSections = 0

  for (const section of ordered) {
    if (remaining <= 0) {
      lockedSections += 1
      continue
    }
    if (section.content.length <= remaining) {
      visible.push(section)
      fullyVisibleSectionIds.push(section.id)
      remaining -= section.content.length
      continue
    }
    visible.push({ ...section, content: `${truncateAtWordBoundary(section.content, remaining)}${PREVIEW_NOTICE}` })
    remaining = 0
  }

  const content = joinSections(visible) + (lockedSections > 0 ? PREVIEW_NOTICE : '')

  return {
    sections: visible,
    content,
    fullyVisibleSectionIds,
    access: {
      ...baseAccess,
      previewApplied: true,
      visibleSections: visible.length,
      lockedSections,
    },
  }
}

// ==================== Public pricing ====================

function formatMegabytes(bytes: number) {
  return `${Math.round(bytes / MEGABYTE)} Mo max / fichier`
}

/** Single source of truth behind `/api/pricing`, the landing page and the workspace. */
export function pricingTiers(): PricingTier[] {
  return TIER_IDS.map((tier) => {
    const definition = TIERS[tier]
    const { limits } = definition
    return {
      id: definition.publicId,
      name: definition.name,
      price: definition.price,
      currency: definition.currency,
      period: definition.period,
      credits: limits.monthlyGenerationCredits,
      features: definition.features,
      recommended: definition.recommended,
      limits: {
        projects: `${limits.activeProjects} projet${limits.activeProjects > 1 ? 's' : ''} actif${limits.activeProjects > 1 ? 's' : ''}`,
        generations: `${limits.monthlyGenerationCredits} générations / mois`,
        documents: `${limits.documentsPerProject} documents / projet`,
        fileSize: formatMegabytes(limits.maxUploadBytes),
        exports: limits.exportFormats.length
          ? `Exports ${limits.exportFormats.map((format) => format.toUpperCase()).join(', ')}`
          : 'Export désactivé',
        preview: limits.previewPages === null
          ? 'Rapport complet et plan détaillé'
          : `Aperçu de ${limits.previewPages} pages, plan détaillé protégé`,
      },
    }
  })
}

export const TIER_LABELS: Record<TierId, string> = {
  FREE: TIERS.FREE.name,
  STARTER: TIERS.STARTER.name,
  PRO: TIERS.PRO.name,
}
