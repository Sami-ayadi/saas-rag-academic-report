import { NextRequest, NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { getAuthenticatedUser } from '@/lib/auth'
import { isStripeConfigured } from '@/lib/billing'
import { getStripeClient } from '@/lib/stripe'

export const runtime = 'nodejs'

/**
 * POST /api/billing/portal — opens the Stripe Customer Portal so the user can
 * manage payment methods, invoices, plan changes and cancellation.
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

    const account = await db.user.findUnique({
      where: { id: user.id },
      select: { id: true, stripeCustomerId: true },
    })
    if (!account) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
    if (!account.stripeCustomerId) {
      return NextResponse.json(
        { error: 'Aucun abonnement Stripe à gérer pour le moment.', code: 'NO_CUSTOMER' },
        { status: 404 },
      )
    }

    const baseUrl = (process.env.NEXTAUTH_URL?.trim() || request.nextUrl.origin).replace(/\/+$/, '')
    const stripe = getStripeClient()
    const portal = await stripe.billingPortal.sessions.create({
      customer: account.stripeCustomerId,
      return_url: `${baseUrl}/dashboard`,
    })

    if (!portal.url) {
      return NextResponse.json({ error: 'Stripe n’a pas renvoyé d’URL de portail' }, { status: 502 })
    }
    return NextResponse.json({ url: portal.url })
  } catch (error) {
    console.error('POST /api/billing/portal error:', error)
    return NextResponse.json({ error: 'Impossible d’ouvrir le portail de facturation' }, { status: 500 })
  }
}