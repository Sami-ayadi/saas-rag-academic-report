import { TIER_LABELS as CANONICAL_TIER_LABELS } from './entitlements'

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

// Plan naming lives in the canonical entitlement module; never duplicate it here.
export const TIER_LABELS: Record<string, string> = CANONICAL_TIER_LABELS

export const TIER_COLORS: Record<string, string> = {
  FREE: 'bg-secondary text-secondary-foreground',
  STARTER: 'bg-primary/15 text-primary',
  PRO: 'bg-accent/15 text-accent-foreground',
}

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
