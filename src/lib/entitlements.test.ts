import { describe, expect, it } from 'vitest'

import {
  PREVIEW_NOTICE,
  TIERS,
  applyReportVisibility,
  buildReportOutline,
  canExport,
  parseReportOutline,
  pricingTiers,
  resolveEntitlements,
  type Entitlements,
  type ReportAccess,
} from './entitlements'
import type { ReportSection } from './types'

function longSection(id: string, title: string, order: number): ReportSection {
  return {
    id,
    title,
    // ~2040 chars each (34 chars x 60): with a 7200-char preview budget, the
    // fourth section crosses the boundary (3 x 2040 = 6120, only 1080 left) so
    // sections 5 and 6 stay locked. Deterministic for the visibility tests.
    content: 'Paragraphe de contenu académique. '.repeat(60),
    status: 'completed',
    order,
  }
}

const FULL_REPORT = {
  sections: [
    longSection('intro', 'Introduction', 0),
    longSection('s1', 'Cadre théorique', 1),
    longSection('s2', 'Méthodologie', 2),
    longSection('s3', 'Résultats', 3),
    longSection('s4', 'Discussion', 4),
    longSection('s5', 'Conclusion', 5),
  ],
  content: '',
}

const FREE = resolveEntitlements({ tier: 'FREE', role: 'USER', creditsLimit: null })
const STARTER = resolveEntitlements({ tier: 'STARTER', role: 'USER', creditsLimit: null })
const PRO = resolveEntitlements({ tier: 'PRO', role: 'USER', creditsLimit: null })
const ADMIN = resolveEntitlements({ tier: 'FREE', role: 'ADMIN', creditsLimit: null })

describe('resolveEntitlements', () => {
  it('applies the tier limits stored on the account', () => {
    expect(FREE.monthlyGenerationCredits).toBe(3)
    expect(FREE.activeProjects).toBe(1)
    expect(STARTER.monthlyGenerationCredits).toBe(15)
    expect(STARTER.activeProjects).toBe(5)
    expect(PRO.monthlyGenerationCredits).toBe(50)
    expect(PRO.activeProjects).toBe(200)
  })

  it('gives administrators the highest tier so support work is never blocked', () => {
    expect(ADMIN.tier).toBe('PRO')
    expect(ADMIN.accountTier).toBe('FREE')
    expect(ADMIN.monthlyGenerationCredits).toBe(PRO.monthlyGenerationCredits)
    expect(ADMIN.exportFormats).toEqual(PRO.exportFormats)
  })

  it('honours the administrator credit override regardless of the stored tier', () => {
    const overridden = resolveEntitlements({ tier: 'FREE', role: 'USER', creditsLimit: 10 })
    expect(overridden.monthlyGenerationCredits).toBe(10)
    // The override only affects generation credits; every other limit comes from the tier.
    expect(overridden.activeProjects).toBe(FREE.activeProjects)
  })

  it('falls back to FREE for an unknown persisted tier instead of trusting the browser', () => {
    const unknown = resolveEntitlements({ tier: 'UNKNOWN' as Entitlements['tier'], role: 'USER' })
    expect(unknown.tier).toBe('FREE')
  })
})

describe('canExport (free export denial)', () => {
  it('denies every format to the free tier', () => {
    expect(canExport(FREE, 'md')).toBe(false)
    expect(canExport(FREE, 'docx')).toBe(false)
    expect(canExport(FREE, 'pdf')).toBe(false)
  })

  it('allows paid tiers to export every format', () => {
    expect(canExport(STARTER, 'md')).toBe(true)
    expect(canExport(STARTER, 'docx')).toBe(true)
    expect(canExport(STARTER, 'pdf')).toBe(true)
    expect(canExport(PRO, 'pdf')).toBe(true)
  })
})

describe('protected outline', () => {
  it('builds outline entries with headings and parses them back', () => {
    const sections = [
      longSection('intro', 'Introduction', 0),
      { ...longSection('s1', 'Sommaire', 1), content: '## 1.1 Fondements\n\n## 1.2 État de l’art\n\nCorps de texte.' },
    ]
    const raw = JSON.stringify(buildReportOutline(sections))
    const parsed = parseReportOutline(raw)
    expect(parsed).toHaveLength(2)
    expect(parsed[1]?.headings).toEqual(['1.1 Fondements', '1.2 État de l’art'])
    expect(parseReportOutline('not-json')).toEqual([])
  })
})
describe('applyReportVisibility (hidden TOC leakage / protected preview)', () => {
  it('gives paying tiers the whole report without a preview notice', () => {
    for (const plan of [STARTER, PRO]) {
      const visible = applyReportVisibility(FULL_REPORT, plan)
      expect(visible.sections).toHaveLength(FULL_REPORT.sections.length)
      expect(visible.access.lockedSections).toBe(0)
      expect(visible.access.previewApplied).toBe(false)
      expect(visible.content).not.toContain('Aperçu limité')
    }
  })

  it('caps the free tier at four preview pages and reports locked sections', () => {
    const visible = applyReportVisibility(FULL_REPORT, FREE)
    const plainText = visible.sections.map((s) => s.title).join(' | ')
    expect(visible.access).toMatchObject<Partial<ReportAccess>>({
      previewApplied: true,
      previewPages: 4,
      visibleSections: 4,
      lockedSections: 2,
      tableOfContents: false,
      exportFormats: [],
      canEditReport: false,
      watermark: true,
    })
    // The locked titles (Discussion, Conclusion) must never reach the free tier,
    // otherwise the preview leaks the protected outline. The section spanning
    // the boundary (Résultats) is shown truncated with its title only because it
    // is partially readable; everything after it stays hidden.
    expect(visible.sections.some((s) => s.title === 'Discussion')).toBe(false)
    expect(visible.sections.some((s) => s.title === 'Conclusion')).toBe(false)
    expect(plainText).not.toContain('Discussion')
    expect(plainText).not.toContain('Conclusion')
    expect(visible.content).toContain(PREVIEW_NOTICE)
    // fullyVisibleSectionIds contains exactly the sections returned in full.
    expect(visible.fullyVisibleSectionIds).toEqual(['intro', 's1', 's2'])
    expect(visible.fullyVisibleSectionIds).not.toContain('s3')
  })

  it('truncates a section spanning the preview boundary at a word boundary', () => {
    const report = {
      content: '',
      sections: [
        { ...longSection('intro', 'Introduction', 0), content: 'T'.repeat(4_000) },
        { ...longSection('s1', 'Cadre théorique', 1), content: 'mot '.repeat(2_000) },
      ],
    }
    const visible = applyReportVisibility(report, FREE)
    // The first section (4000 chars) fits entirely; the second is cut mid-way.
    expect(visible.sections[0]?.id).toBe('intro')
    expect(visible.sections[1]?.id).toBe('s1')
    expect(visible.sections[1]?.content).toContain('Aperçu limité')
    const truncated = visible.sections[1]?.content.replace(PREVIEW_NOTICE, '')
    expect(truncated?.endsWith('mot')).toBe(true)
    expect(visible.fullyVisibleSectionIds).toEqual(['intro'])
  })
})

describe('pricingTiers (single source of truth)', () => {
  it('exposes exactly the canonical tiers with consistent prices', () => {
    const tiers = pricingTiers()
    expect(tiers.map((t) => t.id)).toEqual(['free', 'starter', 'pro'])
    expect(tiers.map((t) => t.price)).toEqual([0, 19, 49])
    expect(tiers.map((t) => t.currency)).toEqual(['€', '€', '€'])
    expect(tiers.find((t) => t.id === 'starter')?.recommended).toBe(true)
  })

  it('renders the free limits without exports and with protected preview', () => {
    const free = pricingTiers().find((t) => t.id === 'free')
    expect(free?.limits.exports).toBe('Export désactivé')
    expect(free?.limits.preview).toContain('plan détaillé protégé')
    expect(free?.credits).toBe(TIERS.FREE.limits.monthlyGenerationCredits)
  })

  it('keeps feature lists aligned with the server-side limits', () => {
    const starter = pricingTiers().find((t) => t.id === 'starter')
    expect(starter?.features.join(' ')).toContain('Exports PDF, DOCX et Markdown')
    expect(starter?.limits.documents).toContain('50 documents')
  })
})