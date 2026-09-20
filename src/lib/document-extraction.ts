import { createHash } from 'node:crypto'

import mammoth from 'mammoth'

export type SupportedDocumentExtension = '.pdf' | '.docx' | '.txt' | '.md'

export interface ExtractedPage {
  pageNumber: number | null
  locator: string
  text: string
}

export interface ExtractedDocument {
  pages: ExtractedPage[]
  pageCount: number | null
  contentHash: string
  warnings: string[]
}

export interface SourceChunk {
  chunkIndex: number
  pageNumber: number | null
  locator: string
  content: string
}

const MAX_PDF_PAGES = 350
const MAX_EXTRACTED_CHARACTERS = 1_500_000
const CHUNK_TARGET = 1_800
const CHUNK_MAX = 2_400

function cleanText(value: string) {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\t\f\v]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function extractPdf(bytes: Buffer): Promise<{ pages: ExtractedPage[]; pageCount: number; warnings: string[] }> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    disableFontFace: true,
    useWorkerFetch: false,
  })
  const pdf = await loadingTask.promise
  if (pdf.numPages > MAX_PDF_PAGES) {
    await loadingTask.destroy()
    throw new Error(`Le PDF dépasse la limite de ${MAX_PDF_PAGES} pages.`)
  }

  const pages: ExtractedPage[] = []
  let totalCharacters = 0
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber)
      const content = await page.getTextContent()
      const parts: string[] = []
      for (const item of content.items) {
        if (!('str' in item)) continue
        parts.push(item.str)
        if ('hasEOL' in item && item.hasEOL) parts.push('\n')
      }
      const text = cleanText(parts.join(' '))
      totalCharacters += text.length
      if (totalCharacters > MAX_EXTRACTED_CHARACTERS) {
        throw new Error('Le texte extrait dépasse la limite autorisée.')
      }
      pages.push({ pageNumber, locator: `pdf-page:${pageNumber}`, text })
      page.cleanup()
    }
  } finally {
    await loadingTask.destroy()
  }

  const usefulPages = pages.filter((page) => page.text.length >= 20)
  const warnings: string[] = []
  if (usefulPages.length === 0) {
    warnings.push('PDF_SCAN_REQUIRES_OCR')
  } else if (usefulPages.length < Math.ceil(pdf.numPages * 0.25)) {
    warnings.push('PDF_PARTIALLY_SCANNED')
  }
  return { pages, pageCount: pdf.numPages, warnings }
}

async function extractDocx(bytes: Buffer) {
  const result = await mammoth.extractRawText({ buffer: bytes })
  const text = cleanText(result.value).slice(0, MAX_EXTRACTED_CHARACTERS)
  return {
    pages: text ? [{ pageNumber: null, locator: 'docx-body', text }] : [],
    pageCount: null,
    warnings: result.messages.map((message) => `DOCX_${message.type.toUpperCase()}:${message.message}`).slice(0, 20),
  }
}

export async function extractDocument(extension: SupportedDocumentExtension, bytes: Buffer): Promise<ExtractedDocument> {
  const contentHash = createHash('sha256').update(bytes).digest('hex')
  if (extension === '.pdf') {
    return { ...(await extractPdf(bytes)), contentHash }
  }
  if (extension === '.docx') {
    return { ...(await extractDocx(bytes)), contentHash }
  }
  const text = cleanText(new TextDecoder('utf-8', { fatal: false }).decode(bytes).replace(/\0/g, ''))
    .slice(0, MAX_EXTRACTED_CHARACTERS)
  return {
    pages: text ? [{ pageNumber: null, locator: `${extension.slice(1)}-body`, text }] : [],
    pageCount: null,
    contentHash,
    warnings: [],
  }
}

function splitLongParagraph(paragraph: string) {
  if (paragraph.length <= CHUNK_MAX) return [paragraph]
  const pieces: string[] = []
  let rest = paragraph
  while (rest.length > CHUNK_MAX) {
    const window = rest.slice(0, CHUNK_MAX)
    const boundary = Math.max(window.lastIndexOf('. '), window.lastIndexOf('; '), window.lastIndexOf(' '))
    const cut = boundary >= CHUNK_TARGET ? boundary + 1 : CHUNK_MAX
    pieces.push(rest.slice(0, cut).trim())
    rest = rest.slice(cut).trim()
  }
  if (rest) pieces.push(rest)
  return pieces
}

export function chunkExtractedDocument(document: ExtractedDocument): SourceChunk[] {
  const chunks: SourceChunk[] = []
  for (const page of document.pages) {
    const paragraphs = page.text.split(/\n{2,}/).flatMap(splitLongParagraph).filter(Boolean)
    let current = ''
    let part = 1
    const flush = () => {
      const content = current.trim()
      if (!content) return
      chunks.push({
        chunkIndex: chunks.length,
        pageNumber: page.pageNumber,
        locator: `${page.locator}:part:${part++}`,
        content,
      })
      current = ''
    }
    for (const paragraph of paragraphs) {
      if (current && current.length + paragraph.length + 2 > CHUNK_MAX) flush()
      current += `${current ? '\n\n' : ''}${paragraph}`
      if (current.length >= CHUNK_TARGET) flush()
    }
    flush()
  }
  return chunks.slice(0, 1_000)
}
