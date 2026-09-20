import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'

import { createReportExport } from './report-export'

const report = {
  title: 'Étude de sécurité — Résultats et amélioration',
  content: '# Introduction\n\nUne synthèse vérifiée.',
  project: { university: 'Université de Tunis', academicLevel: 'Master', field: 'Informatique' },
  sections: Array.from({ length: 5 }, (_, index) => ({
    id: `s${index}`,
    title: index === 0 ? 'Introduction générale' : `Chapitre ${index} : Évaluation`,
    content: '## Objectif\n\nLes données observées sont analysées avec précision.\n\n- Élément vérifié',
    status: 'completed' as const,
    order: index,
  })),
}

describe('createReportExport', () => {
  it('creates a Unicode PDF with cover, contents and numbered section pages', async () => {
    const result = await createReportExport(report, 'pdf')
    const parsed = await PDFDocument.load(result.bytes)
    expect(result.contentType).toBe('application/pdf')
    expect(parsed.getPageCount()).toBeGreaterThanOrEqual(7)
  }, 20_000)

  it('creates a Word document with the report content', async () => {
    const result = await createReportExport(report, 'docx')
    expect(result.bytes.subarray(0, 2).toString()).toBe('PK')
    expect(result.bytes.byteLength).toBeGreaterThan(1_000)
  })
})
