import { afterEach, describe, expect, it } from 'vitest'

import { createReportExport } from './report-export'
import { generateReportForProject, generateSummaryForProject } from './report-generation'

const originalApiKey = process.env.OPENAI_API_KEY
const project = {
  title: 'Migration d’une plateforme vers le cloud',
  brief: 'Étudier et réaliser une migration sécurisée.',
  academicLevel: 'Master',
  university: 'Université de test',
  field: 'Cloud engineering',
  language: 'fr',
  sourceNames: [],
}

afterEach(() => {
  if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY
  else process.env.OPENAI_API_KEY = originalApiKey
})

describe('report generation and exports', () => {
  it('generates a complete local preview without an API key', async () => {
    delete process.env.OPENAI_API_KEY
    const summary = await generateSummaryForProject(project)
    const report = await generateReportForProject(project, summary.content)

    expect(summary.provider).toBe('demo')
    expect(summary.content.length).toBeGreaterThan(500)
    expect(report.provider).toBe('demo')
    expect(report.content.length).toBeGreaterThanOrEqual(4)
  })

  it('creates valid Markdown, DOCX, and PDF payloads', async () => {
    delete process.env.OPENAI_API_KEY
    const generated = await generateReportForProject(project, project.brief)
    const content = generated.content.map((section) => `# ${section.title}\n\n${section.content}`).join('\n\n')
    const exportable = { title: project.title, content, sections: generated.content, project }

    const markdown = await createReportExport(exportable, 'md')
    const docx = await createReportExport(exportable, 'docx')
    const pdf = await createReportExport(exportable, 'pdf')

    expect(markdown.bytes.toString('utf8')).toContain(project.title)
    expect(docx.bytes.subarray(0, 2).toString('ascii')).toBe('PK')
    expect(pdf.bytes.subarray(0, 4).toString('ascii')).toBe('%PDF')
  })
})
