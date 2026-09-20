import { describe, expect, it } from 'vitest'

import { assessReportQuality } from './report-quality'
import type { ReportSection } from './types'

function sections(content = 'Contenu vérifié avec une source [1] (2025).'): ReportSection[] {
  return Array.from({ length: 5 }, (_, index) => ({
    id: `section-${index}`,
    title: index === 4 ? 'Bibliographie' : `Section ${index + 1}`,
    content,
    status: 'completed',
    order: index,
  }))
}

describe('assessReportQuality', () => {
  it('blocks unresolved evidence markers', () => {
    const report = sections()
    report[1].content = '[À COMPLÉTER — preuve requise : version du logiciel]'
    expect(assessReportQuality(report)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'UNRESOLVED_EVIDENCE', severity: 'blocking', sectionId: 'section-1' }),
    ]))
  })

  it('accepts a structured five-section report without blocking issues', () => {
    expect(assessReportQuality(sections()).filter((issue) => issue.severity === 'blocking')).toEqual([])
  })
})
