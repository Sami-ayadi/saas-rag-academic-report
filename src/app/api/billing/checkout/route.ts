import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getAuthenticatedUser } from '@/lib/auth'
import { apiRequestErrorResponse, readJsonBody } from '@/lib/api-input'
import {
  checkoutSessionParams,
  isStripeConfigured,
  priceIdForTier,
  TIER_LABELS,
} from '@/lib/billing'
import { db } from '@/lib/db'
import { getStripeClient } from '@/lib/stripe'
import { stripeErrorToResponse } from '@/lib/stripe-errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CheckoutSchema = z.object({
  tierId: z.enum(['STARTER', 'PRO']),
}).strict()

/**
 * Create a Stripe Checkout session for the authenticated user.
 *
 * Server owns the price resolution — the browser can only pick a tier
 * (STARTER / PRO), never a price. This is what prevents a malicious client
 * from passing a foreign price ID.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Authentication
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  // 2. Verify Stripe is configured
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: 'Stripe billing is not configured on this server' },
      { status: 503 },
    )
  }

  // 3. Validate input
  let parsed: z.infer<typeof CheckoutSchema>
  try {
    parsed = await readJsonBody(request, CheckoutSchema, 2_048)
  } catch (error) {
    return apiRequestErrorResponse(error) ?? NextResponse.json({ error: 'Invalid request body', code: 'INVALID_INPUT' }, { status: 400 })
  }

  const { tierId } = parsed

  // 4. Resolve price ID (server-owned, never from browser)
  const priceId = priceIdForTier(tierId)
  if (!priceId) {
    console.error('[billing] missing price id for tier', { tierId })
    return NextResponse.json(
      { error: 'Stripe price not configured for this plan' },
      { status: 503 },
    )
  }

  // 5. Check for existing active subscription to prevent duplicate charges
  const account = await db.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      tier: true,
      stripeCustomerId: true,
      stripeSubId: true,
    },
  })

  if (!account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  if (account.tier === tierId && account.stripeSubId) {
    return NextResponse.json(
      { error: `You are already subscribed to the ${TIER_LABELS[tierId]} plan` },
      { status: 409 },
    )
  }

  try {
    // 6. Get or create the Stripe customer (idempotent: re-used if present).
    const stripe = getStripeClient()
    let customerId = account.stripeCustomerId
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: account.email ?? undefined,
        metadata: { userId: account.id },
      })
      customerId = customer.id
      // Persist immediately so the webhook can resolve the user even if
      // this request times out before the rest of the body runs.
      await db.user.update({
        where: { id: account.id },
        data: { stripeCustomerId: customerId },
      })
    }

    // 7. Determine base URL (anti-open-redirect)
    const baseUrl = (process.env.NEXTAUTH_URL?.trim() || request.nextUrl.origin).replace(/\/+$/, '')

    // 8. Create checkout session
    const session = await stripe.checkout.sessions.create(
      checkoutSessionParams(
        {
          userId: account.id,
          email: account.email,
          customerId,
          hasActiveSubscription: Boolean(account.stripeSubId),
          tier: account.tier,
        },
        priceId,
        baseUrl,
      ),
    )

    if (!session.url) {
      throw new Error('Stripe checkout session created without URL')
    }

    // 9. Audit trail
    await db.adminAuditLog.create({
      data: {
        actorId: account.id,
        action: 'STRIPE_CHECKOUT_INITIATED',
        severity: 'INFO',
        targetType: 'User',
        targetId: account.id,
        summary: `Checkout initiated for ${tierId} plan`,
        metadata: { tierId, priceId, sessionId: session.id, customerId },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    return stripeErrorToResponse(
      error,
      { route: 'billing.checkout', userId: account.id, tierId, priceId },
      'Failed to create checkout session',
    )
  }
}
