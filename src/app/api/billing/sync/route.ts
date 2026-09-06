import { NextRequest, NextResponse } from 'next/server'

import { getAuthenticatedUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { isStripeConfigured, syncSubscriptionFromStripe } from '@/lib/billing'
import { resolveEntitlements } from '@/lib/entitlements'

export const runtime = 'nodejs'

/**
 * POST /api/billing/sync — pull-based subscription reconciliation.
 *
 * Webhooks are the canonical delivery path, but a payment that happens while
 * `stripe listen` (dev) or the dashboard endpoint (prod) is unreachable would
 * otherwise never update the plan. This endpoint lets the authenticated user
 * ask the server to re-check their Stripe subscription and apply the verified
 * tier. It never trusts a tier sent by the browser: the result is derived from
 * the active subscription's price ID returned by the Stripe API.
 *
 * CSRF: this route is a normal browser mutation and goes through the standard
 * token checks in src/proxy.ts (it is NOT the CSRF-exempt webhook path).
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: 'La facturation Stripe n’est pas activée sur ce serveur.', code: 'STRIPE_NOT_CONFIGURED' },
        { status: 503 },
      )
    }

    const result = await syncSubscriptionFromStripe(user.id)

    const account = await db.user.findUnique({
      where: { id: user.id },
      select: { tier: true, role: true, creditsLimit: true },
    })
    if (!account) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })

    const entitlements = resolveEntitlements({
      tier: account.tier as 'FREE' | 'STARTER' | 'PRO',
      role: account.role,
      creditsLimit: account.creditsLimit,
    })

    return NextResponse.json({ ...result, entitlements })
  } catch (error) {
    console.error('POST /api/billing/sync error:', error)
    return NextResponse.json({ error: 'Impossible de synchroniser votre abonnement' }, { status: 500 })
  }
}