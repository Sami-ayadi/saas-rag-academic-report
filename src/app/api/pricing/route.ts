import { NextResponse } from 'next/server';
import type { PricingTier } from '@/lib/types';

export const runtime = 'nodejs';

const PRICING_TIERS: PricingTier[] = [
  {
    id: 'free',
    name: 'Gratuit',
    price: 0,
    currency: '€',
    period: 'pour toujours',
    credits: 3,
    features: [
      '3 rapports par mois',
      'Synthèse bibliographique automatique',
      'Téléchargement PDF',
      '1 projet actif',
      'Support par email',
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 19,
    currency: '€',
    period: 'par mois',
    credits: 15,
    features: [
      '15 rapports par mois',
      'Synthèse bibliographique automatique',
      'Génération section par section',
      'Régénération de sections',
      'Export PDF & DOCX',
      '5 projets actifs',
      'Support prioritaire',
    ],
    recommended: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 49,
    currency: '€',
    period: 'par mois',
    credits: 50,
    features: [
      '50 rapports par mois',
      'Synthèse bibliographique avancée',
      'Génération section par section',
      'Régénération illimitée des sections',
      'Export PDF, DOCX & LaTeX',
      'Projets illimités',
      'API access',
      'Personnalisation du style académique',
      'Collaboration en équipe',
      'Support dédié',
    ],
  },
];

// GET /api/pricing - Return pricing tiers information
export async function GET() {
  try {
    return NextResponse.json({
      tiers: PRICING_TIERS,
    });
  } catch (error) {
    console.error('GET /api/pricing error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des tarifs' },
      { status: 500 }
    );
  }
}
