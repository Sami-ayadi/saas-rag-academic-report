import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

// GET /api/jobs/[id] - Get generation job status with progress
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const job = await db.generationJob.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
    });

    if (!job) {
      return NextResponse.json(
        { error: 'Job non trouvé' },
        { status: 404 }
      );
    }

    // Parse output data if present
    let parsedOutputData = null;
    if (job.outputData) {
      try {
        parsedOutputData = JSON.parse(job.outputData);
      } catch {
        parsedOutputData = job.outputData;
      }
    }

    return NextResponse.json({
      job: {
        ...job,
        outputData: parsedOutputData,
      },
    });
  } catch (error) {
    console.error('GET /api/jobs/[id] error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du job' },
      { status: 500 }
    );
  }
}
