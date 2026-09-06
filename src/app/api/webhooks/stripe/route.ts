import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'

import { db } from '@/lib/db'
import { applyTierChange, resolveTierFromPriceId } from '@/lib/billing'
import { createNotification } from '@/lib/notifications'
import { getStripeClient, isStripeConfigured } from '@/lib/stripe'

export const runtime = 'nodejs'

/**
 * POST /api/webhooks/stripe — Stripe webhook receiver.
 *
 * SECURITY (documented CSRF exemption): this endpoint is the single
 * CSRF-exempt mutating route in the application because its caller is Stripe's
 * infrastructure, not a browser. The alternative authenticity check required
 * by the security invariants is the mandatory `stripe-signature` verification
 * against the raw request body — unsigned, tampered or stale deliveries are
 * rejected with 400 before any processing.
 */
export async function POST(request: NextRequest) {
  if (!isStripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET?.trim()) {
    return NextResponse.json({ error: 'Stripe webhook non configuré' }, { status: 503 })
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Signature Stripe manquante' }, { status: 400 })
  }

  // The raw body is required for signature verification — never re-serialize.
  const rawBody = await request.text()
  let event: Stripe.Event
  try {
    event = getStripeClient().webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (error) {
    console.error('Stripe webhook signature verification failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Signature Stripe invalide' }, { status: 400 })
  }

  // Idempotency guard: the event ID is the primary key, so a redelivery is a
  // duplicate-key conflict and is acknowledged without reprocessing.
  try {
    await db.processedWebhookEvent.create({ data: { id: event.id, type: event.type } })
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error as { code?: string }).code === 'P2002') {
      return NextResponse.json({ received: true, duplicate: true })
    }
    throw error
  }

  try {
    await processEvent(event)
  } catch (error) {
    // Release the idempotency guard so Stripe's redelivery can retry cleanly.
    await db.processedWebhookEvent.deleteMany({ where: { id: event.id } }).catch(() => undefined)
    console.error('Stripe webhook processing failed:', error)
    return NextResponse.json({ error: 'Traitement du webhook échoué' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

async function processEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
      break
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
      break
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
      break
    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)
      break
    default:
      // Unhandled event types are acknowledged without action.
      break
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  console.log('[stripe-webhook] checkout.session.completed', { id: session.id, mode: session.mode, email: session.customer_email })
  if (session.mode !== 'subscription') {
    console.log('[stripe-webhook] skip: session mode is not subscription', session.mode)
    return
  }
  const userId = session.metadata?.userId ?? session.client_reference_id
  if (!userId) {
    console.log('[stripe-webhook] skip: no userId in metadata/client_reference_id', {
      metadata: session.metadata,
      client_reference_id: session.client_reference_id,
    })
    return
  }
  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
  if (!subscriptionId) {
    console.log('[stripe-webhook] skip: no subscription id', { id: session.id })
    return
  }

  const subscription = await getStripeClient().subscriptions.retrieve(subscriptionId)
  const priceId = subscription.items.data[0]?.price?.id ?? null
  const tier = resolveTierFromPriceId(priceId)
  if (!tier) {
    console.error('[stripe-webhook] skip: unknown price id, no tier applied', { priceId, subscriptionId })
    return
  }
  if (subscription.status !== 'active' && subscription.status !== 'trialing') {
    console.log('[stripe-webhook] skip: subscription status not active/trialing', subscription.status)
    return
  }

  console.log('[stripe-webhook] applying tier change', { userId, tier, priceId, subscriptionId })
  await applyTierChange(userId, tier, {
    source: 'stripe',
    priceId,
    subscriptionId: subscription.id,
    customerId: typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null,
  })
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  const userId =
    subscription.metadata?.userId ??
    (
      await db.user.findFirst({
        where: { stripeSubId: subscription.id },
        select: { id: true },
      })
    )?.id
  if (!userId) return

  const priceId = subscription.items.data[0]?.price?.id ?? null
  const isActive = subscription.status === 'active' || subscription.status === 'trialing'
  const tier = isActive ? (resolveTierFromPriceId(priceId) ?? 'FREE') : 'FREE'

  await applyTierChange(userId, tier, {
    source: 'stripe',
    priceId,
    subscriptionId: subscription.id,
    customerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id ?? null,
  })
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const owner = subscription.metadata?.userId
    ? { id: subscription.metadata.userId }
    : await db.user.findFirst({
        where: { stripeSubId: subscription.id },
        select: { id: true },
      })
  if (!owner) return

  await applyTierChange(owner.id, 'FREE', {
    source: 'stripe',
    subscriptionId: subscription.id,
    customerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id ?? null,
  })
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  // Stripe keeps the subscription active during its dunning grace period: the
  // tier is preserved and the user is informed. No trust decision is derived
  // from this event.
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
  if (!customerId) return
  const owner = await db.user.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  })
  if (!owner) return
  await createNotification({
    userId: owner.id,
    type: 'BILLING_PAYMENT_FAILED',
    title: 'Paiement échoué',
    message:
      'Le paiement de votre abonnement a échoué. Mettez à jour votre moyen de paiement depuis le portail de facturation pour conserver votre plan.',
    linkView: 'pricing',
  }).catch(() => undefined)
}