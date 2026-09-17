import { TIER_LABELS as CANONICAL_TIER_LABELS } from './billing'

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon',
  SUMMARIZING: 'Résumé en cours',
  SUMMARY_READY: 'Résumé prêt',
  GENERATING: 'Génération en cours',
  REPORT_READY: 'Rapport prêt',
  EXPORTED: 'Exporté',
}

export const PROJECT_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-secondary text-secondary-foreground',
  SUMMARIZING: 'bg-primary/15 text-primary',
  SUMMARY_READY: 'bg-accent/15 text-accent-foreground',
  GENERATING: 'bg-primary/15 text-primary',
  REPORT_READY: 'bg-primary text-primary-foreground',
  EXPORTED: 'bg-muted text-muted-foreground',
}

export const JOB_STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  PROCESSING: 'En cours',
  COMPLETED: 'Terminé',
  FAILED: 'Échoué',
  CANCELLED: 'Annulé',
}

export const JOB_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-secondary text-secondary-foreground',
  PROCESSING: 'bg-primary/15 text-primary',
  COMPLETED: 'bg-primary text-primary-foreground',
  FAILED: 'bg-destructive/15 text-destructive',
  CANCELLED: 'bg-muted text-muted-foreground',
}

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  PDF: 'Document PDF',
  DOCX: 'Document Word',
  TXT: 'Fichier texte',
  MARKDOWN: 'Fichier Markdown',
}

// Plan naming lives in the canonical billing module; never duplicate it here.
export const TIER_LABELS: Record<string, string> = CANONICAL_TIER_LABELS

export const TIER_COLORS: Record<string, string> = {
  FREE: 'bg-secondary text-secondary-foreground',
  STARTER: 'bg-primary/15 text-primary',
  PRO: 'bg-accent/15 text-accent-foreground',
}

export const EXPORT_FORMAT_LABELS: Record<string, string> = {
  markdown: 'Markdown',
  pdf: 'PDF',
  docx: 'Word (DOCX)',
}

export const GENDER_LABELS: Record<string, string> = {
  male: 'Homme',
  female: 'Femme',
  other: 'Autre',
  prefer_not_to_say: 'Préfère ne pas dire',
}

export const NOTIFICATION_TYPES = {
  BILLING_PLAN_UPDATED: 'BILLING_PLAN_UPDATED',
  GENERATION_COMPLETE: 'GENERATION_COMPLETE',
  GENERATION_FAILED: 'GENERATION_FAILED',
  QUOTA_WARNING: 'QUOTA_WARNING',
  PROJECT_SHARED: 'PROJECT_SHARED',
} as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES]

export const ACADEMIC_LEVELS = [
  'Licence',
  'Master',
  'Doctorat',
  'Post-Doctorat',
] as const

export const LANGUAGES = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' },
] as const
