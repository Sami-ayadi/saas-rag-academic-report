import { NextResponse } from 'next/server'
import Stripe from 'stripe'

import { StripeConfigError } from './stripe'

/**
 * Map any error from a Stripe-touching route to a NextResponse with the
 * correct status code, a stable, non-leaky message, and full server-side
 * logging context. Use this in every route that calls Stripe.
 *
 * Status-code rationale:
 *   - 400: client-supplied parameters were bad (StripeInvalidRequestError).
 *   - 429: Stripe rate-limited us (StripeRateLimitError). Includes Retry-After.
 *   - 500: non-Stripe error (DB, our own throw, JSON parse, etc.).
 *   - 502: we reached Stripe but Stripe failed us (auth, connection, 5xx,
 *          generic API error). Retrying from the user is unlikely to help,
 *          so we surface a clear message.
 *   - 503: Stripe isn't configured on this server (StripeConfigError). The
 *          503 distinguishes "deploy the key" from "Stripe is down".
 */
export function stripeErrorToResponse(
  error: unknown,
  context: { route: string; [key: string]: unknown },
  fallbackMessage = 'Stripe request failed',
): NextResponse {
  const log = { ...context, error: errorMessageOf(error) }

  if (error instanceof StripeConfigError) {
    console.error('[stripe] misconfigured', log)
    return NextResponse.json(
      { error: 'Stripe billing is not configured on this server' },
      { status: 503 },
    )
  }

  if (error instanceof Stripe.errors.StripeRateLimitError) {
    console.warn('[stripe] rate limited', log)
    const headers: Record<string, string> = {}
    const retryAfter = extractRetryAfter(error)
    if (retryAfter) headers['Retry-After'] = retryAfter
    return NextResponse.json(
      { error: 'Too many requests, please retry shortly' },
      { status: 429, headers },
    )
  }

  if (error instanceof Stripe.errors.StripeConnectionError) {
    console.error('[stripe] connection error', log)
    return NextResponse.json(
      { error: 'Could not reach Stripe. Please retry.' },
      { status: 502 },
    )
  }

  if (error instanceof Stripe.errors.StripeInvalidRequestError) {
    console.error('[stripe] invalid request', { ...log, code: error.code, statusCode: error.statusCode })
    return NextResponse.json({ error: 'Invalid billing request' }, { status: 400 })
  }

  if (
    error instanceof Stripe.errors.StripeAuthenticationError ||
    error instanceof Stripe.errors.StripePermissionError
  ) {
    console.error('[stripe] auth/permission error', log)
    return NextResponse.json({ error: 'Stripe authentication failed' }, { status: 502 })
  }

  if (error instanceof Stripe.errors.StripeError) {
    console.error('[stripe] api error', {
      ...log,
      code: error.code,
      statusCode: error.statusCode,
      type: error.type,
    })
    return NextResponse.json({ error: 'Stripe API error' }, { status: 502 })
  }

  console.error('[stripe] unexpected error', {
    ...log,
    stack: error instanceof Error ? error.stack : undefined,
  })
  return NextResponse.json({ error: fallbackMessage }, { status: 500 })
}

function errorMessageOf(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Unknown error'
}

function extractRetryAfter(error: Stripe.errors.StripeRateLimitError): string | null {
  // Stripe's TypeScript typings don't always expose `headers`, but the
  // runtime value is present on the error instance. We narrow defensively.
  const headers = (error as { headers?: Record<string, string> }).headers
  if (!headers) return null
  return headers['retry-after'] ?? headers['Retry-After'] ?? null
}
