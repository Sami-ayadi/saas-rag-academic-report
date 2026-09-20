import { readFile } from 'node:fs/promises'
import path from 'node:path'

import fontkit from '@pdf-lib/fontkit'
import {
  AlignmentType, Document, Footer, HeadingLevel, PageBreak, PageNumber,
  Packer, Paragraph, TableOfContents, TextRun,
} from 'docx'
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib'

import type { ReportSection } from './types'

export type ExportFormat = 'docx' | 'pdf' | 'md'

export interface ExportableReport {
  title: string
  content: string
  sections: ReportSection[]
  project: { university: string | null; academicLevel: string; field: string | null }
}

function safeFilename(title: string, extension: ExportFormat) {
  const base = title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 100) || 'rapport'
  return `${base}.${extension}`
}

function cleanMarkdown(value: string) {
  return value.replace(/\*\*/g, '').replace(/__([^_]+)__/g, '$1').replace(/`([^`]+)`/g, '$1')
}

function docxParagraphs(markdown: string) {
  return markdown.split(/\r?\n/).map((line) => {
    const text = cleanMarkdown(line.trim())
    if (text.startsWith('### ')) return new Paragraph({ text: text.slice(4), heading: HeadingLevel.HEADING_3 })
    if (text.startsWith('## ')) return new Paragraph({ text: text.slice(3), heading: HeadingLevel.HEADING_2 })
    if (/^[-*]\s+/.test(text)) return new Paragraph({ text: text.replace(/^[-*]\s+/, ''), bullet: { level: 0 }, spacing: { after: 80 } })
    if (/^\d+[.)]\s+/.test(text)) return new Paragraph({ text: text.replace(/^\d+[.)]\s+/, ''), numbering: { reference: 'report-numbering', level: 0 }, spacing: { after: 80 } })
    return new Paragraph({ children: [new TextRun(text)], alignment: AlignmentType.JUSTIFIED, spacing: { after: text ? 140 : 60, line: 330 } })
  })
}

async function createDocx(report: ExportableReport) {
  const body: Paragraph[] = [
    new Paragraph({ text: report.title, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { before: 2200, after: 500 } }),
    new Paragraph({ text: report.project.university ?? '', alignment: AlignmentType.CENTER, spacing: { after: 180 } }),
    new Paragraph({ text: [report.project.academicLevel, report.project.field].filter(Boolean).join(' — '), alignment: AlignmentType.CENTER, spacing: { after: 1000 } }),
    new Paragraph({ children: [new PageBreak()] }),
  ]
  for (const section of report.sections) {
    body.push(new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_1, pageBreakBefore: true }))
    body.push(...docxParagraphs(section.content))
  }
  const footer = new Footer({ children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ children: ['Page ', PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES] })],
  })] })
  const document = new Document({
    creator: 'RAG Report', title: report.title,
    description: 'Brouillon académique structuré et validé dans RAG Report',
    numbering: { config: [{ reference: 'report-numbering', levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.START }] }] },
    styles: { default: { document: { run: { font: 'Aptos', size: 22 }, paragraph: { spacing: { line: 330 } } } } },
    sections: [{
      properties: { page: { margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } } },
      footers: { default: footer },
      children: [
        ...body.slice(0, 4),
        new Paragraph({ text: 'Table des matières', heading: HeadingLevel.HEADING_1 }),
        new TableOfContents('Table des matières', { hyperlink: true, headingStyleRange: '1-3' }),
        ...body.slice(4),
      ],
    }],
  })
  return Packer.toBuffer(document)
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = cleanMarkdown(text).split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (!current || font.widthOfTextAtSize(candidate, size) <= maxWidth) current = candidate
    else { lines.push(current); current = word }
  }
  if (current) lines.push(current)
  return lines
}

async function createPdf(report: ExportableReport) {
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  pdf.setTitle(report.title)
  pdf.setAuthor('RAG Report')
  const fontDirectory = path.join(process.cwd(), 'node_modules', '@fontsource', 'noto-sans', 'files')
  const [regularBytes, boldBytes] = await Promise.all([
    readFile(path.join(fontDirectory, 'noto-sans-latin-400-normal.woff')),
    readFile(path.join(fontDirectory, 'noto-sans-latin-700-normal.woff')),
  ])
  const regular = await pdf.embedFont(regularBytes, { subset: true })
  const bold = await pdf.embedFont(boldBytes, { subset: true })
  const width = 595.28
  const height = 841.89
  const margin = 58

  const cover = pdf.addPage([width, height])
  const centered = (target: PDFPage, value: string, startY: number, size: number, font: PDFFont) => {
    let currentY = startY
    for (const line of wrapText(value, font, size, width - margin * 2)) {
      target.drawText(line, { x: (width - font.widthOfTextAtSize(line, size)) / 2, y: currentY, size, font, color: rgb(0.08, 0.12, 0.2) })
      currentY -= size * 1.4
    }
    return currentY
  }
  let coverY = 575
  coverY = centered(cover, report.title, coverY, 24, bold) - 35
  coverY = centered(cover, report.project.university ?? '', coverY, 12, regular) - 8
  centered(cover, [report.project.academicLevel, report.project.field].filter(Boolean).join(' — '), coverY, 11, regular)

  const tocPageCount = Math.max(1, Math.ceil(report.sections.length / 30))
  const tocPages = Array.from({ length: tocPageCount }, () => pdf.addPage([width, height]))
  const sectionStarts: number[] = []
  let page: PDFPage
  let y = 0
  const newPage = () => { page = pdf.addPage([width, height]); y = height - margin }
  const drawWrapped = (value: string, font: PDFFont, size: number, after = 6, indent = 0) => {
    const lineHeight = size * 1.45
    for (const line of wrapText(value, font, size, width - margin * 2 - indent)) {
      if (y < margin + 28) newPage()
      page.drawText(line, { x: margin + indent, y, size, font, color: rgb(0.08, 0.1, 0.14) })
      y -= lineHeight
    }
    y -= after
  }
  for (const section of report.sections) {
    newPage()
    sectionStarts.push(pdf.getPageCount())
    drawWrapped(section.title, bold, 17, 16)
    for (const rawLine of section.content.split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line) { y -= 7; continue }
      if (line.startsWith('### ')) drawWrapped(line.slice(4), bold, 12, 7)
      else if (line.startsWith('## ')) drawWrapped(line.slice(3), bold, 14, 9)
      else if (/^[-*]\s+/.test(line)) drawWrapped(`• ${line.replace(/^[-*]\s+/, '')}`, regular, 10.5, 5, 12)
      else drawWrapped(line, regular, 10.5, 8)
    }
  }

  tocPages.forEach((tocPage, tocIndex) => {
    tocPage.drawText(tocIndex === 0 ? 'Table des matières' : 'Table des matières (suite)', { x: margin, y: height - margin, size: 19, font: bold })
    let tocY = height - margin - 38
    report.sections.slice(tocIndex * 30, (tocIndex + 1) * 30).forEach((section, localIndex) => {
      const index = tocIndex * 30 + localIndex
      const title = wrapText(section.title, regular, 10.5, width - margin * 2 - 55)[0] ?? section.title
      tocPage.drawText(title, { x: margin, y: tocY, size: 10.5, font: regular })
      const pageLabel = String(sectionStarts[index])
      tocPage.drawText(pageLabel, { x: width - margin - regular.widthOfTextAtSize(pageLabel, 10.5), y: tocY, size: 10.5, font: regular })
      tocY -= 23
    })
  })

  pdf.getPages().forEach((pdfPage, index) => {
    if (index === 0) return
    const label = String(index + 1)
    pdfPage.drawText(label, { x: (width - regular.widthOfTextAtSize(label, 9)) / 2, y: 25, size: 9, font: regular, color: rgb(0.35, 0.38, 0.43) })
  })
  return Buffer.from(await pdf.save())
}

export async function createReportExport(report: ExportableReport, format: ExportFormat) {
  if (format === 'md') return { bytes: Buffer.from(`# ${report.title}\n\n${report.content}`, 'utf8'), contentType: 'text/markdown; charset=utf-8', filename: safeFilename(report.title, format) }
  if (format === 'docx') return { bytes: await createDocx(report), contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', filename: safeFilename(report.title, format) }
  return { bytes: await createPdf(report), contentType: 'application/pdf', filename: safeFilename(report.title, format) }
}
