import Stripe from 'stripe'

import { StripeConfigError } from './stripe'

/**
 * Error thrown when a webhook event cannot be processed after all retries.
 * Carries the event ID for forensic lookup in the ProcessedWebhookEvent table.
 */
export class WebhookProcessingError extends Error {
  readonly kind = 'webhook_processing' as const
  readonly eventId: string
  readonly eventType: string
  readonly cause?: unknown

  constructor(eventId: string, eventType: string, cause?: unknown) {
    const message = `Failed to process webhook event ${eventId} (type: ${eventType}): ${cause instanceof Error ? cause.message : 'Unknown error'}`
    super(message)
    this.name = 'WebhookProcessingError'
    this.eventId = eventId
    this.eventType = eventType
    this.cause = cause
  }
}

/**
 * Maps a webhook verification error to the appropriate HTTP status code.
 * Returns null if the error is not a known webhook verification error
 * (caller should fall through to a generic 500).
 */
export function statusForWebhookVerificationError(error: unknown): number | null {
  if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
    return 400
  }
  if (error instanceof StripeConfigError) {
    return 503
  }
  return null
}

/**
 * Determines if a handler error is retryable.
 *
 * Retryable:
 * - Stripe API errors (transient: network, rate limit, 5xx)
 * - Database connection errors
 *
 * Non-retryable:
 * - Stripe invalid request errors (4xx except 429)
 * - Unknown user (the event will never succeed)
 */
export function isRetryableHandlerError(error: unknown): boolean {
  if (error instanceof Stripe.errors.StripeAPIError) {
    return error.statusCode === 429 || (error.statusCode !== undefined && error.statusCode >= 500)
  }
  if (error instanceof Stripe.errors.StripeConnectionError) {
    return true
  }
  if (error instanceof Stripe.errors.StripeRateLimitError) {
    return true
  }
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: string }).code
    return code === 'P1001' || code === 'P1002' || code === 'P1017'
  }
  return false
}
