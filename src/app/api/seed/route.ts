import { NextResponse } from 'next/server';
import { seedDatabase } from '../../../../db/seed';

export const runtime = 'nodejs';

export async function POST() {
  try {
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
