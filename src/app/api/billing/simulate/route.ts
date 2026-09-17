import { NextRequest, NextResponse } from 'next/server'

import { getAuthenticatedUser } from '@/lib/auth'
import { apiRequestErrorResponse, readJsonBody } from '@/lib/api-input'
import {
  applyTierChange,
  isBillingSimulationEnabled,
  TIER_LABELS,
} from '@/lib/billing'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SimulateSchema = z.object({
  tierId: z.enum(['FREE', 'STARTER', 'PRO']),
}).strict()

/**
 * Local development only: switch plan server-side without payment.
 *
 * This endpoint is ONLY available when AUTH_ALLOW_DEMO=true and
 * NEXT_PUBLIC_AUTH_ALLOW_DEMO=true. In production (where demo auth is
 * disabled), it returns 404.
 */

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Authentication
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  // 2. Verify simulation is enabled (demo auth only)
  if (!isBillingSimulationEnabled()) {
    return NextResponse.json(
      { error: 'Plan simulation is not enabled' },
      { status: 404 },
    )
  }

  // 3. Validate input
  let parsed: z.infer<typeof SimulateSchema>
  try {
    parsed = await readJsonBody(request, SimulateSchema, 2_048)
  } catch (error) {
    return apiRequestErrorResponse(error) ?? NextResponse.json({ error: 'Invalid request body', code: 'INVALID_INPUT' }, { status: 400 })
  }

  const { tierId } = parsed

  try {
    // 4. Apply tier change
    await applyTierChange(user.id, tierId, {
      source: 'simulation',
      actorId: user.id,
    })

    return NextResponse.json({
      success: true,
      tier: tierId,
      message: `Plan changed to ${TIER_LABELS[tierId]}`,
    })
  } catch (error) {
    console.error('[billing] simulation failed', {
      userId: user.id,
      tierId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json(
      { error: 'Failed to simulate plan change' },
      { status: 500 },
    )
  }
}
