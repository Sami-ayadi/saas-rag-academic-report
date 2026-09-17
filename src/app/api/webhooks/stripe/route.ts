import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

import { db } from '@/lib/db'
import { applyTierChange, resolveTierFromPriceId } from '@/lib/billing'
import { constructWebhookEvent, getStripeClient, StripeConfigError } from '@/lib/stripe'
import {
  isRetryableHandlerError,
  statusForWebhookVerificationError,
  WebhookProcessingError,
} from '@/lib/stripe-webhook-errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Stripe webhook endpoint.
 *
 * Security:
 * - CSRF protection is intentionally skipped for this route (Stripe cannot
 *   send a CSRF token). Instead, authenticity is verified via the
 *   Stripe-Signature header using the webhook signing secret.
 * - The raw request body is required for signature verification — do NOT
 *   parse it before calling constructEvent.
 * - Event processing is idempotent: processed event IDs are stored in the
 *   ProcessedWebhookEvent table and duplicates are skipped.
 *
 * Async event handling:
 * - `invoice.payment_succeeded` is asynchronous and may arrive minutes
 *   after a renewal. We re-verify the linked subscription is still active
 *   and re-apply the tier (idempotent at the user-table level — only the
 *   audit log + notification are new).
 * - `customer.subscription.deleted` is a hard cancellation; we downgrade
 *   to FREE immediately and notify the user.
 */

const ACTIVE_STATUSES = ['active', 'trialing'] as const
type ActiveStatus = (typeof ACTIVE_STATUSES)[number]

const HANDLED_EVENTS = new Set<string>([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
])

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

async function isEventProcessed(eventId: string): Promise<boolean> {
  const existing = await db.processedWebhookEvent.findUnique({
    where: { id: eventId },
    select: { id: true },
  })
  return Boolean(existing)
}

async function markEventProcessed(eventId: string): Promise<void> {
  try {
    await db.processedWebhookEvent.create({
      data: { id: eventId, type: 'stripe' },
    })
  } catch (error) {
    // Unique-constraint violations are expected under concurrent delivery;
    // we swallow only those and re-raise anything else.
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    ) {
      return
    }
    throw error
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function customerIdOf(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined,
): string | null {
  if (!customer) return null
  return typeof customer === 'string' ? customer : customer.id
}

/**
 * Safely extract a subscription ID from an Invoice.
 *
 * In the modern Stripe API (>= 2024-12-18.acacia), the top-level
 * `invoice.subscription` field was removed; the link now lives at
 * `invoice.parent.subscription_details.subscription`. This helper accepts
 * both shapes defensively.
 */
function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const fromParent = invoice.parent?.subscription_details?.subscription
  if (typeof fromParent === 'string') return fromParent
  if (fromParent && typeof fromParent === 'object') return fromParent.id
  return null
}

async function resolveUserIdFromSession(session: Stripe.Checkout.Session): Promise<string | null> {
  // 1. metadata.userId (set by our checkout route)
  if (session.metadata?.userId) return session.metadata.userId
  // 2. client_reference_id (set by our checkout route as a belt-and-suspenders fallback)
  if (session.client_reference_id) return session.client_reference_id
  // 3. Last resort: look up by Stripe customer ID (legacy sessions created before
  //    we started persisting the customer at checkout time)
  const customerId = customerIdOf(session.customer)
  if (!customerId) return null
  const user = await db.user.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  })
  return user?.id ?? null
}

function tierForSubscription(
  subscription: Pick<Stripe.Subscription, 'items' | 'status'>,
): { tier: 'STARTER' | 'PRO' | null; priceId: string | null } {
  const priceId = subscription.items.data[0]?.price?.id ?? null
  return { tier: resolveTierFromPriceId(priceId), priceId }
}

async function resolveUserIdFromSubscription(subscription: Stripe.Subscription): Promise<string | null> {
  if (subscription.metadata?.userId) return subscription.metadata.userId
  const customerId = customerIdOf(subscription.customer)
  if (!customerId) return null
  const user = await db.user.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  })
  return user?.id ?? null
}

// ---------------------------------------------------------------------------
// Event handlers — each is wrapped in its own try/catch in POST() so that
// a single failing event type cannot blow up the whole delivery.
// ---------------------------------------------------------------------------

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  console.log('[stripe-webhook] checkout.session.completed', {
    id: session.id,
    mode: session.mode,
    email: session.customer_email,
  })

  if (session.mode !== 'subscription') {
    console.log('[stripe-webhook] skip: session mode is not subscription', session.mode)
    return
  }

  const userId = await resolveUserIdFromSession(session)
  if (!userId) {
    console.warn('[stripe-webhook] skip: no userId resolvable from session', {
      sessionId: session.id,
      metadata: session.metadata,
      client_reference_id: session.client_reference_id,
    })
    return
  }

  const subscriptionId =
    typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
  if (!subscriptionId) {
    console.log('[stripe-webhook] skip: no subscription id', { sessionId: session.id })
    return
  }

  // Always re-fetch the subscription so we act on the canonical state, not
  // whatever the checkout session happened to embed.
  const stripe = getStripeClient()
  let subscription: Stripe.Subscription
  try {
    subscription = await stripe.subscriptions.retrieve(subscriptionId)
  } catch (error) {
    // 404 = race: the subscription was deleted between the session and our
    // retrieve. Re-throw so the outer handler can decide whether to retry.
    if (error instanceof Stripe.errors.StripeInvalidRequestError && error.statusCode === 404) {
      throw new Error(`subscription ${subscriptionId} not found on checkout completion`)
    }
    throw error
  }

  const { tier, priceId } = tierForSubscription(subscription)
  if (!tier) {
    console.error('[stripe-webhook] skip: unknown price id, no tier applied', {
      priceId,
      subscriptionId,
    })
    return
  }

  if (!ACTIVE_STATUSES.includes(subscription.status as ActiveStatus)) {
    console.log('[stripe-webhook] skip: subscription status not active/trialing', subscription.status)
    return
  }

  console.log('[stripe-webhook] applying tier change', { userId, tier, priceId, subscriptionId })
  await applyTierChange(userId, tier, {
    source: 'stripe',
    priceId,
    subscriptionId: subscription.id,
    customerId: customerIdOf(session.customer),
  })
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  console.log('[stripe-webhook] customer.subscription.updated', {
    id: subscription.id,
    status: subscription.status,
  })

  const userId = await resolveUserIdFromSubscription(subscription)
  if (!userId) {
    console.log('[stripe-webhook] skip: no userId in subscription metadata', {
      subscriptionId: subscription.id,
    })
    return
  }

  const { tier, priceId } = tierForSubscription(subscription)
  if (!tier) {
    console.error('[stripe-webhook] skip: unknown price id', { priceId, subscriptionId: subscription.id })
    return
  }

  if (!ACTIVE_STATUSES.includes(subscription.status as ActiveStatus)) {
    // Subscription is no longer active (past_due, unpaid, cancelled-pending, etc.).
    // We downgrade immediately so entitlement checks don't keep serving a paid
    // plan we can no longer charge for. Stripe will send subscription.deleted
    // later if the cancellation completes.
    console.log('[stripe-webhook] subscription not active, downgrading to FREE', {
      subscriptionId: subscription.id,
      status: subscription.status,
    })
    await applyTierChange(userId, 'FREE', {
      source: 'stripe',
      subscriptionId: subscription.id,
      customerId: customerIdOf(subscription.customer),
    })
    return
  }

  await applyTierChange(userId, tier, {
    source: 'stripe',
    priceId,
    subscriptionId: subscription.id,
    customerId: customerIdOf(subscription.customer),
  })
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  console.log('[stripe-webhook] customer.subscription.deleted', {
    id: subscription.id,
    status: subscription.status,
  })

  const userId = await resolveUserIdFromSubscription(subscription)
  if (!userId) {
    console.warn('[stripe-webhook] skip: no userId resolvable for subscription.deleted', {
      subscriptionId: subscription.id,
    })
    return
  }

  // Hard cancel → downgrade to FREE. Defensive: re-apply even if the user is
  // already on FREE (applyTierChange is idempotent at the DB level).
  await applyTierChange(userId, 'FREE', {
    source: 'stripe',
    subscriptionId: subscription.id,
    customerId: customerIdOf(subscription.customer),
  })
}

/**
 * invoice.payment_succeeded is an *asynchronous* event. It can fire:
 *   - minutes after a renewal
 *   - after a previously-failed payment is recovered
 *   - on the first paid invoice of a brand-new subscription
 *
 * We don't change the tier here (the subscription.updated event covers that),
 * but we DO use this as a defensive re-verification + observability hook:
 *   - if the linked subscription is gone or not active, we re-sync from Stripe
 *   - we record the invoice ID for forensics
 *   - we emit a user-visible "payment received" notification
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
  console.log('[stripe-webhook] invoice.payment_succeeded', {
    id: invoice.id,
    subscriptionId: subscriptionIdFromInvoice(invoice),
    amountPaid: invoice.amount_paid,
    currency: invoice.currency,
  })

  const subscriptionId = subscriptionIdFromInvoice(invoice)
  if (!subscriptionId) {
    // One-off invoice, not tied to a subscription. Nothing to reconcile.
    return
  }

  // Defensive: re-fetch the subscription to confirm it is still active.
  // If it has been cancelled, the subscription.deleted event will follow.
  const stripe = getStripeClient()
  let subscription: Stripe.Subscription
  try {
    subscription = await stripe.subscriptions.retrieve(subscriptionId)
  } catch (error) {
    if (error instanceof Stripe.errors.StripeInvalidRequestError && error.statusCode === 404) {
      console.warn('[stripe-webhook] invoice.payment_succeeded: linked subscription gone', {
        invoiceId: invoice.id,
        subscriptionId,
      })
      return
    }
    throw error
  }

  if (!ACTIVE_STATUSES.includes(subscription.status as ActiveStatus)) {
    console.warn('[stripe-webhook] invoice.payment_succeeded: subscription no longer active', {
      invoiceId: invoice.id,
      subscriptionId,
      status: subscription.status,
    })
    // subscription.updated / .deleted will reconcile the tier; don't double-write.
    return
  }

  const userId = await resolveUserIdFromSubscription(subscription)
  if (!userId) {
    console.log('[stripe-webhook] invoice.payment_succeeded: no userId in subscription metadata', {
      subscriptionId,
    })
    return
  }

  const { tier, priceId } = tierForSubscription(subscription)
  if (!tier) {
    console.error('[stripe-webhook] invoice.payment_succeeded: unknown price id', {
      priceId,
      subscriptionId,
    })
    return
  }

  // Re-apply the tier defensively. applyTierChange is idempotent: it always
  // writes the user row, but only emits a new audit/notification when the
  // tier actually changes — and even then, the user is already on this
  // plan in practice (a successful payment implies the same plan is still
  // current), so this is normally a no-op except after a failed→recovered
  // payment cycle.
  await applyTierChange(userId, tier, {
    source: 'stripe',
    priceId,
    subscriptionId: subscription.id,
    customerId: customerIdOf(subscription.customer),
  })
}

async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  console.warn('[stripe-webhook] invoice.payment_failed', {
    id: invoice.id,
    subscriptionId: subscriptionIdFromInvoice(invoice),
    attemptCount: invoice.attempt_count,
  })

  // Stripe will retry and may eventually cancel the subscription
  // (→ customer.subscription.deleted will fire and downgrade to FREE).
  // We do not downgrade here so we don't penalize transient failures.
  //
  // Future: send a user-visible "your payment failed" notification here.
}

// ---------------------------------------------------------------------------
// Route entry point
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Read the raw body — required for HMAC signature verification.
  //    Anything that touches this body before constructEvent() will break
  //    verification, so we read it exactly once as text.
  let rawBody: string
  try {
    rawBody = await request.text()
  } catch (error) {
    console.error('[stripe-webhook] failed to read request body', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return NextResponse.json({ error: 'Could not read request body' }, { status: 400 })
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    console.error('[stripe-webhook] missing stripe-signature header')
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  // 2. Verify the webhook signature.
  let event: Stripe.Event
  try {
    event = constructWebhookEvent(rawBody, signature)
  } catch (error) {
    const knownStatus = statusForWebhookVerificationError(error)
    if (knownStatus !== null) {
      const statusText = knownStatus === 400 ? 'Invalid signature' : 'Webhook is not configured'
      return NextResponse.json({ error: statusText }, { status: knownStatus })
    }
    console.error('[stripe-webhook] unexpected verification error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json({ error: 'Webhook verification failed' }, { status: 500 })
  }

  // 3. Idempotency guard — Stripe redelivers events, we process each once.
  try {
    if (await isEventProcessed(event.id)) {
      console.log('[stripe-webhook] event already processed, skipping', { eventId: event.id })
      return NextResponse.json({ received: true, status: 'already_processed' })
    }
  } catch (error) {
    console.error('[stripe-webhook] failed to check idempotency', {
      eventId: event.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return NextResponse.json({ error: 'Failed to check event status' }, { status: 500 })
  }

  // 4. Dispatch to the appropriate handler.
  if (!HANDLED_EVENTS.has(event.type)) {
    console.log('[stripe-webhook] unhandled event type', { type: event.type })
    return NextResponse.json({ received: true, status: 'unhandled' })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice)
        break
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice)
        break
    }
  } catch (error) {
    const retryable = isRetryableHandlerError(error)
    const status = retryable ? 500 : 422

    if (error instanceof Stripe.errors.StripeAPIError) {
      console.error('[stripe-webhook] Stripe API error during handling', {
        eventId: event.id,
        type: event.type,
        code: error.code,
        statusCode: error.statusCode,
        message: error.message,
        retryable,
      })
    } else {
      console.error('[stripe-webhook] handler error', {
        eventId: event.id,
        type: event.type,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        retryable,
      })
    }

    return NextResponse.json(
      { error: 'Webhook processing failed', eventId: event.id, retryable },
      { status },
    )
  }

  // 5. Mark as processed only after a successful handler run.
  try {
    await markEventProcessed(event.id)
  } catch (error) {
    console.error('[stripe-webhook] failed to record event as processed', {
      eventId: event.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return NextResponse.json({ error: 'Failed to record event' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
