import { NextResponse } from 'next/server';
import { seedDatabase } from '../../../../db/seed';
import { getAuthenticatedUser } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST() {
  try {
    if (process.env.NODE_ENV === 'production' || process.env.AUTH_ALLOW_DEMO !== 'true') {
      return NextResponse.json({ error: 'Endpoint indisponible' }, { status: 404 });
    }

    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const result = await seedDatabase();
    return NextResponse.json({
      message: 'Base de données peuplée avec succès',
      data: result,
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json(
      { error: 'Erreur lors du peuplement de la base de données' },
      { status: 500 }
    );
  }
}
