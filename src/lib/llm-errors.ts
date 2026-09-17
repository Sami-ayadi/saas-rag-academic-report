export class LlmHttpError extends Error {
  constructor(
    readonly status: number,
    requestId: string | null,
  ) {
    super(`LLM generation failed (${status}${requestId ? `, request ${requestId}` : ''})`)
    this.name = 'LlmHttpError'
  }
}

export function isNonRetryableLlmError(error: unknown): boolean {
  return error instanceof LlmHttpError && error.status >= 400 && error.status < 500 && error.status !== 408
}

const failureMessages = {
  payment: 'Le modèle IA sélectionné nécessite des crédits. Choisissez un modèle gratuit ou ajoutez des crédits OpenRouter.',
  rateLimit: 'Limite de requêtes du fournisseur IA atteinte. Attendez le renouvellement du quota avant de réessayer.',
  rateLimitResumable: 'Limite de requêtes du fournisseur IA atteinte. Les sections enregistrées seront reprises après renouvellement du quota.',
  access: 'La clé API IA est invalide ou n’a pas accès au modèle configuré.',
  model: 'Le modèle IA configuré est introuvable. Vérifiez LLM_REPORT_MODEL.',
  request: 'La requête a été refusée par le fournisseur IA. Vérifiez le modèle configuré.',
} as const

export function publicLlmFailureMessage(error: unknown, hasSavedSections = false): string | null {
  if (!(error instanceof LlmHttpError)) return null
  if (error.status === 402) return failureMessages.payment
  if (error.status === 429) return hasSavedSections ? failureMessages.rateLimitResumable : failureMessages.rateLimit
  if (error.status === 401 || error.status === 403) return failureMessages.access
  if (error.status === 404) return failureMessages.model
  if (error.status === 400 || error.status === 413 || error.status === 422) return failureMessages.request
  return null
}

const safeFailureMessages = new Set<string>(Object.values(failureMessages))
safeFailureMessages.add('Limite de requêtes du fournisseur IA atteinte. Réessayez plus tard.')
safeFailureMessages.add('Limite de requêtes du fournisseur IA atteinte. Réessayez plus tard : la progression enregistrée sera reprise.')

export function publicReportFailureMessage(storedMessage: string | null): string {
  return storedMessage && safeFailureMessages.has(storedMessage)
    ? storedMessage
    : 'Échec de la génération du rapport'
}
