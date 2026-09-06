import type Stripe from 'stripe'

import { isDemoAuthAllowed } from './auth-policy'
import { db } from './db'
import { TIER_LABELS, type TierId } from './entitlements'
import { createNotification } from './notifications'
import { getStripeClient } from './stripe'

/**
 * Server-owned billing configuration. The persisted plan tier is always derived
 * from a verified Stripe price ID — never from a field sent by the browser.
 */

export type BillableTier = 'STARTER' | 'PRO'
export const BILLABLE_TIERS: readonly BillableTier[] = ['STARTER', 'PRO']

const PRICE_ENV: Record<BillableTier, string> = {
  STARTER: 'STRIPE_PRICE_STARTER_ID',
  PRO: 'STRIPE_PRICE_PRO_ID',
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim())
}

export function priceIdForTier(tier: BillableTier): string | null {
  const priceId = process.env[PRICE_ENV[tier]]?.trim()
  return priceId || null
}

/** Inverse mapping used by the webhook: a verified price ID decides the tier. */
export function resolveTierFromPriceId(priceId: string | null | undefined): BillableTier | null {
  if (!priceId) return null
  for (const tier of BILLABLE_TIERS) {
    if (priceIdForTier(tier) === priceId) return tier
  }
  return null
}

/**
 * The plan simulator exists only for local development (demo sessions): it lets
 * a developer switch tiers without payment to exercise the real entitlement
 * logic. It is unreachable as soon as demo auth is disabled.
 */
export function isBillingSimulationEnabled(): boolean {
  return isDemoAuthAllowed(process.env)
}

export interface TierChangeOptions {
  source: 'stripe' | 'simulation'
  priceId?: string | null
  subscriptionId?: string | null
  customerId?: string | null
  /** Acting administrator/user for audit attribution (simulation only). */
  actorId?: string | null
}

/**
 * The single reconciliation path shared by the Stripe webhook and the local
 * simulator: whatever calls this exercises the exact production logic.
 */
export async function applyTierChange(
  userId: string,
  tier: TierId,
  options: TierChangeOptions,
) {
  const before = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, tier: true, email: true, stripeCustomerId: true, stripeSubId: true },
  })
  if (!before) throw new Error(`applyTierChange: unknown user ${userId}`)

  // A downgraded account no longer owns an active subscription record.
  const subscriptionId = tier === 'FREE' ? null : (options.subscriptionId ?? before.stripeSubId)
  const updated = await db.user.update({
    where: { id: userId },
    data: {
      tier,
      stripeSubId: subscriptionId,
      ...(options.customerId ? { stripeCustomerId: options.customerId } : {}),
      ...(options.priceId ? { stripePriceId: options.priceId } : {}),
    },
    select: { id: true, tier: true, email: true },
  })

  await db.adminAuditLog.create({
    data: {
      actorId: options.actorId ?? null,
      action: 'BILLING_TIER_CHANGE',
      severity: 'INFO',
      targetType: 'user',
      targetId: userId,
      targetLabel: before.email ?? userId,
      summary: `Plan ${before.tier} → ${tier} (source: ${options.source}${options.priceId ? `, price ${options.priceId}` : ''})`,
      metadata: {
        before: before.tier,
        after: tier,
        source: options.source,
        priceId: options.priceId ?? null,
        subscriptionId: options.subscriptionId ?? null,
        customerId: options.customerId ?? null,
      },
    },
  })

  await createNotification({
    userId,
    type: 'BILLING_PLAN_UPDATED',
    title: 'Plan mis à jour',
    message: `Votre plan est désormais : ${TIER_LABELS[tier]}.`,
    linkView: 'pricing',
    metadata: { tier, source: options.source },
  }).catch(() => undefined)

  return updated
}

export interface CheckoutSessionContext {
  userId: string
  email: string | null
  customerId: string | null
  hasActiveSubscription: boolean
  tier: TierId
}

/** Narrow the checkout input to what Stripe needs; nothing else is trusted. */
export function checkoutSessionParams(context: CheckoutSessionContext, priceId: string, baseUrl: string) {
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
  if (context.customerId) params.customer = context.customerId
  else if (context.email) params.customer_email = context.email
  return params
}

export interface BillingSyncResult {
  tier: TierId
  changed: boolean
  subscriptionId: string | null
  customerId: string | null
  priceId: string | null
}

/**
 * Pure helper: among a list of Stripe subscriptions, pick the most recently
 * created one that is currently active or trialing. Exported for unit tests;
 * `syncSubscriptionFromStripe` uses it to derive the verified tier.
 */
export function pickActiveSubscription<T extends { status: string; created: number }>(
  subscriptions: T[],
): T | null {
  return (
    subscriptions
      .filter((s) => s.status === 'active' || s.status === 'trialing')
      .sort((a, b) => b.created - a.created)[0] ?? null
  )
}

/**
 * Pull-based reconciliation (safety net for missed webhooks).
 *
 * Webhooks are the canonical push path, but they depend on `stripe listen`
 * (dev) or a dashboard endpoint (prod) being reachable at delivery time. If a
 * payment succeeded while the listener was down, the plan would never update.
 *
 * This function queries Stripe directly for the authenticated user's current
 * active subscription and applies the tier derived from the verified price ID.
 * It shares `applyTierChange` with the webhook, so the entitlement/audit path
 * is exactly the production one. The browser never dictates the result.
 */
export async function syncSubscriptionFromStripe(userId: string): Promise<BillingSyncResult> {
  const account = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, tier: true, stripeCustomerId: true },
  })
  if (!account) throw new Error(`syncSubscriptionFromStripe: unknown user ${userId}`)

  const customerId = account.stripeCustomerId
  if (!customerId) {
    // No Stripe customer attached: there is nothing to reconcile.
    return { tier: account.tier, changed: false, subscriptionId: null, customerId: null, priceId: null }
  }

  const stripe = getStripeClient()
  const subscriptions = await stripe.subscriptions.list({ customer: customerId, limit: 20, status: 'all' })
  const preferred = pickActiveSubscription(subscriptions.data)

  if (!preferred) {
    // The customer exists but has no active subscription on Stripe: the account
    // is effectively free. A clean downgrade keeps the database honest.
    await applyTierChange(userId, 'FREE', { source: 'stripe', customerId })
    return { tier: 'FREE', changed: account.tier !== 'FREE', subscriptionId: null, customerId, priceId: null }
  }

  const priceId = preferred.items.data[0]?.price?.id ?? null
  const tier = resolveTierFromPriceId(priceId)
  if (!tier) {
    console.error('[billing-sync] unknown price id; tier unchanged', { priceId, customerId, subscriptionId: preferred.id })
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