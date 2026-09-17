import type { Tier } from '@prisma/client'
import Stripe from 'stripe'

import { db } from './db'
import { createNotification } from './notifications'
import { getStripeClient, isStripeConfigured } from './stripe'

// Re-exported so billing-touching routes have a single, stable import surface
// (`@/lib/billing`) for both billing logic and Stripe config checks.
export { isStripeConfigured }

export type BillableTier = 'STARTER' | 'PRO'

export const BILLABLE_TIERS: BillableTier[] = ['STARTER', 'PRO']

export const TIER_LABELS: Record<Tier, string> = {
  FREE: 'Gratuit',
  STARTER: 'Starter',
  PRO: 'Professionnel',
}

export const TIER_CREDITS: Record<Tier, number> = {
  FREE: 3,
  STARTER: 20,
  PRO: 100,
}

// ---------------------------------------------------------------------------
// Server-owned tier <-> price mapping. The browser never dictates the price.
// ---------------------------------------------------------------------------

export function priceIdForTier(tier: BillableTier): string | null {
  const key = tier === 'STARTER' ? 'STRIPE_PRICE_STARTER_ID' : 'STRIPE_PRICE_PRO_ID'
  return process.env[key] || null
}

export function resolveTierFromPriceId(priceId: string | null | undefined): BillableTier | null {
  if (!priceId) return null
  if (priceId === process.env.STRIPE_PRICE_STARTER_ID) return 'STARTER'
  if (priceId === process.env.STRIPE_PRICE_PRO_ID) return 'PRO'
  return null
}

// ---------------------------------------------------------------------------
// Local simulation flag (demo auth only)
// ---------------------------------------------------------------------------

export function isBillingSimulationEnabled(): boolean {
  return (
    process.env.AUTH_ALLOW_DEMO === 'true' &&
    process.env.NEXT_PUBLIC_AUTH_ALLOW_DEMO === 'true'
  )
}

// ---------------------------------------------------------------------------
// Shared reconciliation: the single function that applies any tier change.
// Used by webhooks, sync, and simulation so audit + entitlements are uniform.
// ---------------------------------------------------------------------------

export interface TierChangeOptions {
  source: 'stripe' | 'sync' | 'simulation' | 'admin'
  priceId?: string | null
  subscriptionId?: string | null
  customerId?: string | null
  actorId?: string | null
}

export async function applyTierChange(
  userId: string,
  tier: Tier,
  options: TierChangeOptions,
): Promise<{ id: string; tier: Tier }> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, tier: true },
  })
  if (!user) {
    throw new Error(`applyTierChange: unknown user ${userId}`)
  }

  const isDowngradeToFree = tier === 'FREE'

  const updated = await db.user.update({
    where: { id: userId },
    data: {
      tier,
      creditsLimit: TIER_CREDITS[tier],
      ...(isDowngradeToFree
        ? { stripeSubId: null, stripePriceId: null }
        : {
            stripePriceId: options.priceId ?? undefined,
            stripeSubId: options.subscriptionId ?? undefined,
            stripeCustomerId: options.customerId ?? undefined,
          }),
    },
    select: { id: true, tier: true },
  })

  // Audit log (non-blocking: failure here must not break the tier change)
  try {
    await db.adminAuditLog.create({
      data: {
        actorId: options.actorId ?? null,
        action: 'BILLING_TIER_CHANGE',
        severity: 'INFO',
        targetType: 'User',
        targetId: userId,
        summary: `${user.tier} → ${tier} (source: ${options.source})`,
        metadata: {
          previousTier: user.tier,
          newTier: tier,
          source: options.source,
          priceId: options.priceId ?? null,
          subscriptionId: options.subscriptionId ?? null,
          customerId: options.customerId ?? null,
        },
      },
    })
  } catch (error) {
    console.error('[billing] failed to write audit log for tier change', { userId, tier, error })
  }

  // User notification (non-blocking)
  if (options.source !== 'simulation') {
    await createNotification({
      userId,
      type: 'BILLING_PLAN_UPDATED',
      title: 'Plan mis à jour',
      message: `Votre plan est désormais : ${TIER_LABELS[tier]}.`,
      linkView: 'pricing',
      metadata: { tier, source: options.source },
    }).catch(() => undefined)
  }

  return updated
}

// ---------------------------------------------------------------------------
// Checkout session parameters (server-owned, never trusts the browser)
// ---------------------------------------------------------------------------

export interface CheckoutSessionContext {
  userId: string
  email: string | null
  customerId: string | null
  hasActiveSubscription: boolean
  tier: Tier
}

export function checkoutSessionParams(
  context: CheckoutSessionContext,
  priceId: string,
  baseUrl: string,
): Stripe.Checkout.SessionCreateParams {
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: context.userId,
    success_url: `${baseUrl}/dashboard?billing=success`,
    cancel_url: `${baseUrl}/dashboard?billing=cancelled`,
    allow_promotion_codes: false,
    metadata: { userId: context.userId },
    subscription_data: {
      metadata: { userId: context.userId },
    },
  }
  if (context.customerId) {
    params.customer = context.customerId
  } else if (context.email) {
    params.customer_email = context.email
  }
  return params
}

// ---------------------------------------------------------------------------
// Pull-based reconciliation (safety net for missed webhooks)
// ---------------------------------------------------------------------------

export interface BillingSyncResult {
  tier: Tier
  changed: boolean
  subscriptionId: string | null
  customerId: string | null
  priceId: string | null
}

export function pickActiveSubscription<T extends { status: string; created: number }>(
  subscriptions: T[],
): T | null {
  return (
    subscriptions
      .filter((s) => s.status === 'active' || s.status === 'trialing')
      .sort((a, b) => b.created - a.created)[0] ?? null
  )
}

export async function syncSubscriptionFromStripe(userId: string): Promise<BillingSyncResult> {
  const account = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, tier: true, stripeCustomerId: true },
  })
  if (!account) {
    throw new Error(`syncSubscriptionFromStripe: unknown user ${userId}`)
  }

  const customerId = account.stripeCustomerId
  if (!customerId) {
    return { tier: account.tier, changed: false, subscriptionId: null, customerId: null, priceId: null }
  }

  const stripe = getStripeClient()
  let subscriptions: Stripe.ApiList<Stripe.Subscription>
  try {
    subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 20,
      status: 'all',
    })
  } catch (error) {
    // Surface the underlying Stripe error so the route can log + return 502.
    if (error instanceof Stripe.errors.StripeError) {
      throw new BillingSyncError(
        `Stripe API error while listing subscriptions: ${error.message}`,
        error,
      )
    }
    throw error
  }

  const preferred = pickActiveSubscription(subscriptions.data)

  if (!preferred) {
    await applyTierChange(userId, 'FREE', { source: 'stripe', customerId })
    return { tier: 'FREE', changed: account.tier !== 'FREE', subscriptionId: null, customerId, priceId: null }
  }

  const priceId = preferred.items.data[0]?.price?.id ?? null
  const tier = resolveTierFromPriceId(priceId)
  if (!tier) {
    console.error('[billing-sync] unknown price id; tier unchanged', {
      priceId,
      customerId,
      subscriptionId: preferred.id,
    })
    return { tier: account.tier, changed: false, subscriptionId: preferred.id, customerId, priceId }
  }

  await applyTierChange(userId, tier, {
    source: 'stripe',
    priceId,
    subscriptionId: preferred.id,
    customerId,
  })

  return { tier, changed: account.tier !== tier, subscriptionId: preferred.id, customerId, priceId }
}

/**
 * Wraps a Stripe API failure during a billing sync so the route layer can
 * log it once with full context and surface a clean error to the client.
 */
export class BillingSyncError extends Error {
  readonly kind = 'stripe_api' as const
  readonly cause?: unknown
  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'BillingSyncError'
    this.cause = cause
  }
}