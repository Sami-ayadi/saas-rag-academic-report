import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from 'docx'
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'

import type { ReportSection } from './types'

export type ExportFormat = 'docx' | 'pdf' | 'md'

export interface ExportableReport {
  title: string
  content: string
  sections: ReportSection[]
  project: {
    university: string | null
    academicLevel: string
    field: string | null
  }
}

function safeFilename(title: string, extension: ExportFormat) {
  const base = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 100) || 'rapport'
  return `${base}.${extension}`
}

function docxParagraphs(markdown: string) {
  return markdown.split(/\r?\n/).map((line) => {
    const trimmed = line.trim()
    if (trimmed.startsWith('### ')) {
      return new Paragraph({ text: trimmed.slice(4), heading: HeadingLevel.HEADING_3 })
    }
    if (trimmed.startsWith('## ')) {
      return new Paragraph({ text: trimmed.slice(3), heading: HeadingLevel.HEADING_2 })
    }
    if (/^[-*]\s+/.test(trimmed)) {
      return new Paragraph({ text: trimmed.replace(/^[-*]\s+/, ''), bullet: { level: 0 } })
    }
    return new Paragraph({ children: [new TextRun(trimmed)], spacing: { after: trimmed ? 120 : 40 } })
  })
}

async function createDocx(report: ExportableReport) {
  const children: Paragraph[] = [
    new Paragraph({ text: report.title, heading: HeadingLevel.TITLE }),
    new Paragraph({ text: report.project.university ?? '', spacing: { after: 120 } }),
    new Paragraph({ text: [report.project.academicLevel, report.project.field].filter(Boolean).join(' — '), spacing: { after: 400 } }),
  ]

  for (const section of report.sections) {
    children.push(new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_1 }))
    children.push(...docxParagraphs(section.content))
  }

  const document = new Document({
    creator: 'RAG Report',
    title: report.title,
    description: 'Rapport académique généré avec RAG Report',
    sections: [{ properties: {}, children }],
  })
  return Packer.toBuffer(document)
}

function pdfSafeText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[•·]/g, '-')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '?')
}

function wrapPdfText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = pdfSafeText(text).split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !current) current = candidate
    else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

async function createPdf(report: ExportableReport) {
  const document = await PDFDocument.create()
  document.setTitle(pdfSafeText(report.title))
  document.setAuthor('RAG Report')
  const regular = await document.embedFont(StandardFonts.Helvetica)
  const bold = await document.embedFont(StandardFonts.HelveticaBold)
  const pageWidth = 595.28
  const pageHeight = 841.89
  const margin = 54
  let page: PDFPage = document.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  const addPage = () => {
    page = document.addPage([pageWidth, pageHeight])
    y = pageHeight - margin
  }
  const drawWrapped = (text: string, font: PDFFont, size: number, gap = 4, indent = 0) => {
    const lineHeight = size * 1.35
    for (const line of wrapPdfText(text, font, size, pageWidth - (margin * 2) - indent)) {
      if (y < margin + lineHeight) addPage()
      page.drawText(line, { x: margin + indent, y, size, font, color: rgb(0.1, 0.1, 0.1) })
      y -= lineHeight
    }
    y -= gap
  }

  drawWrapped(report.title, bold, 21, 18)
  drawWrapped(report.project.university ?? '', regular, 11, 5)
  drawWrapped([report.project.academicLevel, report.project.field].filter(Boolean).join(' - '), regular, 11, 28)

  for (const section of report.sections) {
    drawWrapped(section.title, bold, 16, 10)
    for (const line of section.content.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed) y -= 5
      else if (trimmed.startsWith('### ')) drawWrapped(trimmed.slice(4), bold, 12, 6)
      else if (trimmed.startsWith('## ')) drawWrapped(trimmed.slice(3), bold, 13, 7)
      else if (/^[-*]\s+/.test(trimmed)) drawWrapped(`- ${trimmed.replace(/^[-*]\s+/, '')}`, regular, 10.5, 5, 12)
      else drawWrapped(trimmed.replace(/\*\*/g, ''), regular, 10.5, 7)
    }
    y -= 8
  }

  return Buffer.from(await document.save())
}

export async function createReportExport(report: ExportableReport, format: ExportFormat) {
  if (format === 'md') {
    return {
      bytes: Buffer.from(`# ${report.title}\n\n${report.content}`, 'utf8'),
      contentType: 'text/markdown; charset=utf-8',
      filename: safeFilename(report.title, format),
    }
  }
  if (format === 'docx') {
    return {
      bytes: await createDocx(report),
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      filename: safeFilename(report.title, format),
    }
  }
  return {
    bytes: await createPdf(report),
    contentType: 'application/pdf',
    filename: safeFilename(report.title, format),
  }
}
