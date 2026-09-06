import { NextResponse } from 'next/server';
import { pricingTiers } from '@/lib/entitlements';

export const runtime = 'nodejs';

// GET /api/pricing - Public pricing, rendered from the canonical entitlement module.
export async function GET() {
  try {
    return NextResponse.json({ tiers: pricingTiers() });
  } catch (error) {
    console.error('GET /api/pricing error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des tarifs' },
      { status: 500 }
    );
  }
}
