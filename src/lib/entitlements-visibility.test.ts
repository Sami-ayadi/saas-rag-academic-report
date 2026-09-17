import { describe, expect, it } from 'vitest'

import { applyReportVisibility, canExport, resolveEntitlements } from './entitlements'
import type { ReportSection } from './types'

describe('FREE report visibility', () => {
  it('keeps export format aliases aligned with the API', () => {
    expect(canExport(resolveEntitlements({ tier: 'FREE' }), 'md')).toBe(false)
    expect(canExport(resolveEntitlements({ tier: 'STARTER' }), 'md')).toBe(true)
  })
  it('never returns locked titles or body text through section or content fields', () => {
    const sections: ReportSection[] = [
      { id: 'intro', title: 'Introduction', content: 'texte '.repeat(1300), status: 'completed', order: 0 },
      { id: 'locked', title: 'SECRET_LOCKED_TITLE', content: 'SECRET_LOCKED_BODY '.repeat(100), status: 'completed', order: 1 },
    ]
    const result = applyReportVisibility({
      sections,
      content: sections.map((section) => `# ${section.title}\n\n${section.content}`).join('\n\n'),
    }, resolveEntitlements({ tier: 'FREE' }))
    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain('SECRET_LOCKED_TITLE')
    expect(serialized).not.toContain('SECRET_LOCKED_BODY')
    expect(result.fullyVisibleSectionIds).toEqual([])
    expect(result.sections[0].content.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(1120)
  })
})
