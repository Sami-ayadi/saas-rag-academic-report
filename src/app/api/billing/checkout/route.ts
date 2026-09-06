import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'

import { apiRequestErrorResponse, readJsonBody } from '@/lib/api-input'
import { checkoutSessionParams, isStripeConfigured, priceIdForTier } from '@/lib/billing'
import { db } from '@/lib/db'
import { getAuthenticatedUser } from '@/lib/auth'
import { getStripeClient } from '@/lib/stripe'

export const runtime = 'nodejs'

const checkoutSchema = z.object({
  tierId: z.enum(['free', 'starter', 'pro']),
}).strict()

/**
 * POST /api/billing/checkout — creates a Stripe Checkout Session for the
 * requested paid plan. The tier is resolved server-side from the configured
 * price ID; the browser never dictates the plan or the price.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: 'Le paiement par carte n’est pas encore activé sur ce serveur.', code: 'STRIPE_NOT_CONFIGURED' },
        { status: 503 },
      )
    }

    const { tierId } = await readJsonBody(request, checkoutSchema)

    // The free tier is not billable. Returning a clear 4xx keeps the pricing
    // page from ever rendering a 500 when a downgrade-to-free is requested.
    if (tierId === 'free') {
      return NextResponse.json(
        {
          error: 'Le plan Gratuit ne nécessite pas de paiement. Retournez au plan Gratuit avec le portail de facturation.',
          code: 'FREE_NOT_BILLABLE',
        },
        { status: 400 },
      )
    }

    const tier = tierId.toUpperCase() as 'STARTER' | 'PRO'
    const priceId = priceIdForTier(tier)
    if (!priceId) {
      return NextResponse.json(
        { error: 'Ce plan n’a pas de tarif Stripe configuré côté serveur.', code: 'STRIPE_PRICE_MISSING' },
        { status: 503 },
      )
    }

    const account = await db.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, tier: true, stripeCustomerId: true, stripeSubId: true },
    })
    if (!account) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })

    if (account.tier === tier) {
      return NextResponse.json(
        { error: `Vous êtes déjà sur le plan ${tier.toLowerCase()}.`, code: 'ALREADY_ON_TIER' },
        { status: 409 },
      )
    }
    if (account.stripeSubId) {
      return NextResponse.json(
        {
          error: 'Vous avez déjà un abonnement actif. Utilisez le portail de facturation pour changer de plan.',
          code: 'SUBSCRIPTION_EXISTS',
        },
        { status: 409 },
      )
    }

    // Canonical base URL: the trusted NEXTAUTH_URL when present, so a spoofed
    // Origin header can never turn success_url into an open redirect.
    const baseUrl = (process.env.NEXTAUTH_URL?.trim() || request.nextUrl.origin).replace(/\/+$/, '')

    const stripe = getStripeClient()
    const session = await stripe.checkout.sessions.create(
      checkoutSessionParams(
        {
          userId: account.id,
          email: account.email,
          customerId: account.stripeCustomerId,
          hasActiveSubscription: Boolean(account.stripeSubId),
          tier,
        },
        priceId,
        baseUrl,
      ),
    )

    if (!session.url) {
      return NextResponse.json({ error: 'Stripe n’a pas renvoyé d’URL de paiement' }, { status: 502 })
    }
    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('POST /api/billing/checkout error:', error)
    const requestError = apiRequestErrorResponse(error)
    if (requestError) return requestError
    return NextResponse.json({ error: 'Impossible de créer la session de paiement' }, { status: 500 })
  }
}