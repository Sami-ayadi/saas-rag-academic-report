import Stripe from 'stripe'

/**
 * Lazily-instantiated Stripe client. The SDK is only usable when
 * STRIPE_SECRET_KEY is present; every caller must check isStripeConfigured()
 * first and answer with a clear 503 otherwise.
 */
let client: Stripe | null = null

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim())
}

export function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim()
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY is not configured')
  if (!client) client = new Stripe(secretKey)
  return client
}