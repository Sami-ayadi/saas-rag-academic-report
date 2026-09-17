import { NextRequest, NextResponse } from 'next/server'

import { getAuthenticatedUser } from '@/lib/auth'
import { isStripeConfigured, syncSubscriptionFromStripe } from '@/lib/billing'
import { stripeErrorToResponse } from '@/lib/stripe-errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Pull-based reconciliation endpoint.
 *
 * This is a safety net for when a webhook was missed (e.g., `stripe listen`
 * was not running during development, or a transient failure in production).
 * It queries Stripe directly for the authenticated user's current active
 * subscription and applies the tier derived from the verified price ID.
 *
 * The browser never dictates the result — the tier is always resolved from
 * the Stripe price ID.
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

  try {
    // 3. Sync subscription from Stripe
    const result = await syncSubscriptionFromStripe(user.id)

    return NextResponse.json({
      tier: result.tier,
      changed: result.changed,
      subscriptionId: result.subscriptionId,
    })
  } catch (error) {
    return stripeErrorToResponse(
      error,
      { route: 'billing.sync', userId: user.id },
      'Failed to sync subscription',
    )
  }
}
