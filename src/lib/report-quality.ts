import type { ReportSection } from '@/lib/types'

export type QualitySeverity = 'blocking' | 'warning'

export interface ReportQualityIssue {
  code: string
  severity: QualitySeverity
  sectionId?: string
  message: string
}

const unresolvedPatterns = [
  /\[à compléter\b/i,
  /\bà vérifier par (?:l['’])?étudiant\b/i,
  /\bnom de .{0,40}à préciser\b/i,
  /\buser safety\s*:/i,
]

function normalizedParagraphs(content: string) {
  return content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim().toLowerCase())
    .filter((paragraph) => paragraph.length >= 180)
}

export function assessReportQuality(sections: ReportSection[]): ReportQualityIssue[] {
  const issues: ReportQualityIssue[] = []
  const seenParagraphs = new Map<string, string>()
  for (const section of sections) {
    for (const pattern of unresolvedPatterns) {
      if (pattern.test(section.content)) {
        issues.push({
          code: pattern.source.includes('user safety') ? 'INTERNAL_MARKER' : 'UNRESOLVED_EVIDENCE',
          severity: 'blocking',
          sectionId: section.id,
          message: `La section « ${section.title} » contient une information à compléter ou un marqueur interne.`,
        })
        break
      }
    }
    for (const paragraph of normalizedParagraphs(section.content)) {
      const previousSection = seenParagraphs.get(paragraph)
      if (previousSection && previousSection !== section.id) {
        issues.push({
          code: 'DUPLICATE_PARAGRAPH',
          severity: 'warning',
          sectionId: section.id,
          message: `Un paragraphe de « ${section.title} » répète mot pour mot une autre section.`,
        })
        break
      }
      seenParagraphs.set(paragraph, section.id)
    }
    if (/bibliograph|webograph|références/i.test(section.title) &&
        !/(https?:\/\/|doi\b|\[[0-9]+\]|\([12][0-9]{3}\))/i.test(section.content)) {
      issues.push({
        code: 'BIBLIOGRAPHY_NOT_STRUCTURED',
        severity: 'blocking',
        sectionId: section.id,
        message: 'La bibliographie ne contient aucune notice vérifiable structurée.',
      })
    }
  }
  if (sections.length < 5) {
    issues.push({ code: 'REPORT_TOO_FRAGMENTARY', severity: 'blocking', message: 'Le rapport ne contient pas assez de sections pour être validé.' })
  }
  return issues
}

