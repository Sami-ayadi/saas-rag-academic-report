import { describe, expect, it } from 'vitest'

import { generateReportForProject, generateSummaryForProject } from './report-generation'

/**
 * Opt-in integration test against a real OpenAI-compatible endpoint (Ollama).
 * Run with a local Ollama server:
 *   ollama serve
 *   ollama pull qwen2.5:1.5b
 *   RUN_OLLAMA_E2E=1 npx vitest run src/lib/llm-integration.test.ts
 * Skipped automatically in every other run so CI and offline machines stay green.
 */
const runE2E = process.env.RUN_OLLAMA_E2E === '1'

const project = {
  title: 'Supervision d’un parc de conteneurs Docker dans une PME',
  brief:
    'Mettre en place une supervision légère du parc Docker de la PME : collecte des métriques, alertes simples, tableau de bord, et documentation de l’exploitation pour l’équipe support.',
  academicLevel: 'Licence',
  university: 'IUT de test',
  field: 'Cloud engineering',
  language: 'fr',
  sourceNames: ['notes-stage.txt'],
  sourceExcerpts: [
    'L’équipe support dispose de douze serveurs Linux sous Docker et cherche à détecter les redémarrages anormaux des conteneurs applicatifs.',
  ],
}

describe.skipIf(!runE2E)('real LLM integration (OpenAI-compatible endpoint)', () => {
  it('generates a summary through a real model call', { timeout: 240_000 }, async () => {
    const summary = await generateSummaryForProject(project)

    expect(summary.provider).toBe('openai-compatible')
    expect(summary.model).toBe(process.env.OPENAI_REPORT_MODEL ?? 'qwen2.5:1.5b')
    expect(summary.content.length).toBeGreaterThan(400)
    // Very small local models occasionally answer in English despite the
    // directive, so accept both languages here; the pipeline contract is what
    // this test verifies, not the linguistic quality of a 1.5B model.
    expect(summary.content).toMatch(/objectif|objective|méthodologie|methodology|contexte|context/i)
  })

  it('generates schema-valid report sections through a real model call', { timeout: 300_000 }, async () => {
    const summary = await generateSummaryForProject(project)
    const report = await generateReportForProject(project, summary.content)

    expect(report.provider).toBe('openai-compatible')
    expect(report.content.length).toBeGreaterThanOrEqual(4)
    for (const section of report.content) {
      expect(section.title.length).toBeGreaterThan(0)
      expect(section.content.length).toBeGreaterThanOrEqual(100)
    }
  })
})