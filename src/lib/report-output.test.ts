import { afterEach, describe, expect, it, vi } from 'vitest'

import { createReportExport } from './report-export'
import { generateReportForProject, generateSummaryForProject, isLlmConfigured, reviseReportSection } from './report-generation'
import type { ReportSection } from './types'

const originalEnv = {
  LLM_API_KEY: process.env.LLM_API_KEY,
  LLM_BASE_URL: process.env.LLM_BASE_URL,
  LLM_REPORT_MODEL: process.env.LLM_REPORT_MODEL,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
  OPENAI_REPORT_MODEL: process.env.OPENAI_REPORT_MODEL,
  OPENAI_JSON_MODE: process.env.OPENAI_JSON_MODE,
}

const project = {
  title: 'Migration d’une plateforme vers le cloud',
  brief: 'Étudier et réaliser une migration sécurisée.',
  academicLevel: 'Master',
  university: 'Université de test',
  field: 'Cloud engineering',
  language: 'fr',
  sourceNames: [],
}

function restoreEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
}

afterEach(restoreEnv)

function chatCompletion(text: string, usage = { prompt_tokens: 111, completion_tokens: 222 }) {
  return {
    ok: true,
    headers: new Headers(),
    json: async () => ({
      choices: [{ message: { content: text } }],
      usage,
    }),
  } as Response
}

const fourSections: ReportSection[] = [
  {
    id: 'introduction',
    title: 'Introduction',
    content:
      'Cette section introduit le contexte du stage et la problématique étudiée avec précision, en présentant l’entreprise, le service d’accueil et les objectifs pédagogiques visés.',
    status: 'completed',
    order: 0,
  },
  {
    id: 'conclusion',
    title: 'Conclusion',
    content:
      'Cette section conclut le rapport en résumant les apprentissages, les compétences développées au cours de la période de stage ainsi que les perspectives professionnelles envisagées.',
    status: 'completed',
    order: 1,
  },
  {
    id: 'methodologie',
    title: 'Méthodologie',
    content:
      'Cette section décrit la démarche suivie, les outils mobilisés, la planification des tâches et les limites rencontrées pendant la réalisation des missions confiées.',
    status: 'completed',
    order: 2,
  },
  {
    id: 'resultats',
    title: 'Résultats',
    content:
      'Cette section présente les résultats obtenus au cours de la période de stage réalisée, en les reliant aux objectifs fixés et aux attentes de l’équipe d’accueil.',
    status: 'completed',
    order: 3,
  },
]

describe('report generation and exports', () => {
  it('requires a hosted API key and never substitutes local report text', async () => {
    delete process.env.LLM_API_KEY
    delete process.env.OPENAI_API_KEY
    await expect(generateSummaryForProject(project)).rejects.toThrow('LLM_API_KEY')
    await expect(generateReportForProject(project, project.brief ?? '')).rejects.toThrow('LLM_API_KEY')
  })

  it('calls an OpenAI-compatible chat-completions endpoint with a bearer key and reports usage', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    process.env.OPENAI_BASE_URL = 'https://llm.example.test/v1'
    process.env.OPENAI_REPORT_MODEL = 'qwen2.5:1.5b'
    delete process.env.OPENAI_JSON_MODE
    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      chatCompletion('Synthèse académique générée par le modèle compatible OpenAI pour le projet de stage.'),
    )
    vi.stubGlobal('fetch', fetchMock)

    const summary = await generateSummaryForProject(project)

    expect(summary.provider).toBe('openai-compatible')
    expect(summary.model).toBe('qwen2.5:1.5b')
    expect(summary.inputTokens).toBe(111)
    expect(summary.outputTokens).toBe(222)
    expect(summary.content).toContain('modèle compatible OpenAI')

    const [url, request] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('https://llm.example.test/v1/chat/completions')
    expect((request?.headers as Record<string, string>).Authorization).toBe('Bearer test-key')
    const body = JSON.parse((request?.body ?? '{}') as string) as {
      model: string
      messages: Array<{ role: string; content: string }>
      max_tokens: number
      response_format: { type: string }
    }
    expect(body.model).toBe('qwen2.5:1.5b')
    expect(body.messages[0].role).toBe('system')
    expect(body.max_tokens).toBe(3_000)
    // The summary returns Markdown, so no JSON response format is requested.
    expect(body.response_format).toBeUndefined()
  })

  it('creates valid Markdown, DOCX, and PDF payloads', async () => {
    const content = fourSections.map((section) => `# ${section.title}\n\n${section.content}`).join('\n\n')
    const exportable = { title: project.title, content, sections: fourSections, project }

    const markdown = await createReportExport(exportable, 'md')
    const docx = await createReportExport(exportable, 'docx')
    const pdf = await createReportExport(exportable, 'pdf')

    expect(markdown.bytes.toString('utf8')).toContain(project.title)
    expect(docx.bytes.subarray(0, 2).toString('ascii')).toBe('PK')
    expect(pdf.bytes.subarray(0, 4).toString('ascii')).toBe('%PDF')
  })

  it('keeps strict json_schema mode for the official OpenAI host and parses fenced JSON', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    process.env.OPENAI_BASE_URL = 'https://api.openai.com/v1'
    delete process.env.OPENAI_JSON_MODE
    const fenced = '```json\n' + JSON.stringify({ sections: fourSections }) + '\n```'
    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      chatCompletion(fenced, { prompt_tokens: 10, completion_tokens: 20 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const report = await generateReportForProject(project, project.brief ?? '')

    expect(report.provider).toBe('openai-compatible')
    expect(report.content.map((section) => section.id)).toEqual([
      'introduction',
      'conclusion',
      'methodologie',
      'resultats',
    ])
    const body = JSON.parse((fetchMock.mock.calls[0][1]?.body ?? '{}') as string) as {
      max_completion_tokens: number
      response_format: { type: string }
    }
    expect(body.max_completion_tokens).toBe(12_000)
    expect(body.response_format.type).toBe('json_schema')
  })

  it('fails closed when the model returns an invalid report payload', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    process.env.OPENAI_BASE_URL = 'https://llm.example.test/v1'
    process.env.OPENAI_JSON_MODE = 'off'
    vi.stubGlobal('fetch', vi.fn(async () => chatCompletion('{"sections":"not-an-array"}')))
    await expect(generateReportForProject(project, project.brief ?? '')).rejects.toThrow()
  })

  it('rejects a local model endpoint even when an API key is present', async () => {
    process.env.LLM_API_KEY = 'test-key'
    process.env.LLM_BASE_URL = 'http://localhost:11434/v1'
    expect(isLlmConfigured()).toBe(false)
    await expect(generateSummaryForProject(project)).rejects.toThrow('hosted HTTPS')
  })

  it('revises a section through the hosted API and treats instructions as untrusted data', async () => {
    process.env.LLM_API_KEY = 'test-key'
    process.env.LLM_BASE_URL = 'https://llm.example.test/v1'
    process.env.LLM_REPORT_MODEL = 'openrouter/free'
    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => chatCompletion('Ce contenu révisé est une prose académique complète qui conserve les faits fournis par l’étudiant et explique les objectifs et la méthode de façon claire.'))
    vi.stubGlobal('fetch', fetchMock)
    const result = await reviseReportSection(project, fourSections[0], 'Améliorer la méthode')
    expect(result.provider).toBe('openai-compatible')
    expect(result.content).toContain('contenu révisé')
    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string)
    expect(body.messages[0].content).toContain('untrusted data')
    expect(body.messages[1].content).toContain('UNTRUSTED_REVISION_INPUT_JSON')
  })
})
