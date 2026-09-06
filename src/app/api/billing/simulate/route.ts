import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'

import { getAuthenticatedUser } from '@/lib/auth'
import { applyTierChange, isBillingSimulationEnabled } from '@/lib/billing'
import { apiRequestErrorResponse, readJsonBody } from '@/lib/api-input'
import type { TierId } from '@/lib/entitlements'

export const runtime = 'nodejs'

const simulationSchema = z.object({
  tierId: z.enum(['free', 'starter', 'pro']),
}).strict()

/**
 * POST /api/billing/simulate — LOCAL DEVELOPMENT ONLY.
 *
 * Applies a plan change without payment so a developer can exercise the real
 * entitlement logic (quotas, preview, exports, TOC protection) on every tier.
 * It shares `applyTierChange` with the Stripe webhook, so what is tested here
 * is the production reconciliation path. The endpoint is indistinguishable
 * from a non-existent route (404) unless demo auth is enabled, and it never
 * runs in production.
 */
export async function POST(request: NextRequest) {
  try {
    if (!isBillingSimulationEnabled()) {
      return NextResponse.json({ error: 'Endpoint indisponible' }, { status: 404 })
    }

    const user = await getAuthenticatedUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { tierId } = await readJsonBody(request, simulationSchema)
    const tier = tierId.toUpperCase() as TierId

    const updated = await applyTierChange(user.id, tier, {
      source: 'simulation',
      actorId: user.id,
    })

    return NextResponse.json({
      tier: updated.tier,
      message: `Plan de test activé sans paiement : ${updated.tier} (simulation locale).`,
    })
  } catch (error) {
    console.error('POST /api/billing/simulate error:', error)
    const requestError = apiRequestErrorResponse(error)
    if (requestError) return requestError
    return NextResponse.json({ error: 'Impossible de simuler le changement de plan' }, { status: 500 })
  }
}