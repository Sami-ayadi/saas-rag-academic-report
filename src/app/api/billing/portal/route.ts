import { NextRequest, NextResponse } from 'next/server'

import { getAuthenticatedUser } from '@/lib/auth'
import { isStripeConfigured } from '@/lib/billing'
import { db } from '@/lib/db'
import { getStripeClient } from '@/lib/stripe'
import { stripeErrorToResponse } from '@/lib/stripe-errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Customer Portal endpoint.
 *
 * Creates a Stripe Billing Portal session so the user can manage their
 * subscription, payment methods, and billing history.
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

  // 3. Get user's Stripe customer ID
  const account = await db.user.findUnique({
    where: { id: user.id },
    select: { stripeCustomerId: true },
  })

  if (!account?.stripeCustomerId) {
    return NextResponse.json(
      { error: 'No active subscription found' },
      { status: 404 },
    )
  }

  try {
    // 4. Determine base URL (anti-open-redirect)
    const baseUrl = (process.env.NEXTAUTH_URL?.trim() || request.nextUrl.origin).replace(/\/+$/, '')

    // 5. Create portal session
    const stripe = getStripeClient()
    const session = await stripe.billingPortal.sessions.create({
      customer: account.stripeCustomerId,
      return_url: `${baseUrl}/dashboard?billing=portal`,
    })

    if (!session.url) {
      throw new Error('Stripe portal session created without URL')
    }

    return NextResponse.json({ url: session.url })
  } catch (error) {
    return stripeErrorToResponse(
      error,
      {
        route: 'billing.portal',
        userId: user.id,
        customerId: account.stripeCustomerId,
      },
      'Failed to create portal session',
    )
  }
}
