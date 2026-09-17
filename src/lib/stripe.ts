import Stripe from 'stripe'

/**
 * Lazy Stripe client initialization.
 *
 * Security:
 * - The client is created on first use and reused for the life of the process.
 * - Throws if STRIPE_SECRET_KEY is missing — callers should check
 *   `isStripeConfigured()` before calling `getStripeClient()`.
 * - Network-level failures are retried up to `maxNetworkRetries` times
 *   (idempotent Stripe requests only); other errors are surfaced.
 */

let stripeClient: Stripe | null = null

export function getStripeClient(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new StripeConfigError('STRIPE_SECRET_KEY is not set')
  }
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, {
      // Pinned to the SDK's expected API version (Stripe SDK 22.6.1).
      apiVersion: '2026-08-26.dahlia',
      typescript: true,
      maxNetworkRetries: 3,
      timeout: 10_000,
    })
  }
  return stripeClient
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

export function isStripeWebhookConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET)
}

export function requireStripeConfigured(): void {
  if (!isStripeConfigured()) {
    throw new StripeConfigError('Stripe billing is not configured on this server')
  }
}

export function requireStripeWebhookConfigured(): void {
  if (!isStripeWebhookConfigured()) {
    throw new StripeConfigError(
      'Stripe webhook verification is not configured (STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are required)',
    )
  }
}

/**
 * Custom error class for local configuration issues. Lets callers distinguish
 * "the server is misconfigured" (no point retrying) from real Stripe API
 * failures (transient — Stripe will retry).
 */
export class StripeConfigError extends Error {
  readonly kind = 'config' as const
  constructor(message: string) {
    super(message)
    this.name = 'StripeConfigError'
  }
}

/**
 * Verifies a Stripe webhook signature and returns the parsed event.
 *
 * Security:
 * - The payload MUST be the raw, unparsed body (no JSON.stringify round-trip).
 * - The signature MUST come from the `stripe-signature` header.
 * - `tolerance` defaults to 5 minutes (Stripe's recommended max). Increase
 *   only if you have a known clock-skew reason.
 *
 * Throws:
 * - `StripeConfigError` if STRIPE_WEBHOOK_SECRET is missing.
 * - `Stripe.errors.StripeSignatureVerificationError` for invalid signatures,
 *   stale timestamps, or malformed payloads.
 * - Any other error is wrapped in `StripeWebhookVerificationError`.
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
  options: { tolerance?: number } = {},
): Stripe.Event {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new StripeConfigError('STRIPE_WEBHOOK_SECRET is required to verify webhook signatures')
  }
  if (!signature) {
    throw new StripeConfigError('Missing stripe-signature header')
  }

  try {
    return getStripeClient().webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
      options.tolerance,
    )
  } catch (error) {
    // Re-throw Stripe's own signature error verbatim — callers (the webhook
    // route) need to distinguish it from generic config errors so they can
    // return the right HTTP status (400 for bad signature, 500 otherwise).
    if (error instanceof Stripe.errors.StripeError) {
      throw error
    }
    // Anything else (TypeError on bad Buffer, etc.) is wrapped so we never
    // accidentally leak raw library stack traces to the webhook response.
    throw new StripeWebhookVerificationError(
      error instanceof Error ? error.message : 'Unknown webhook verification error',
      error,
    )
  }
}

export class StripeWebhookVerificationError extends Error {
  readonly kind = 'verification' as const
  readonly cause?: unknown
  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'StripeWebhookVerificationError'
    this.cause = cause
  }
}
