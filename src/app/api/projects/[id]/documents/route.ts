import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod/v4';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'nodejs';

const uploadDocumentSchema = z.object({
  filename: z.string().min(1),
  originalName: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number().positive(),
  content: z.string().min(1),
});

// GET /api/projects/[id]/documents - List documents for a project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const project = await db.project.findUnique({ where: { id } });

    if (!project) {
      return NextResponse.json(
        { error: 'Projet non trouvé' },
        { status: 404 }
      );
    }

    const documents = await db.document.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ documents });
  } catch (error) {
    console.error('GET /api/projects/[id]/documents error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des documents' },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/documents - Upload document
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const project = await db.project.findUnique({ where: { id } });

    if (!project) {
      return NextResponse.json(
        { error: 'Projet non trouvé' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validated = uploadDocumentSchema.parse(body);

    // Generate a storage key
    const storageKey = `documents/${id}/${validated.filename}`;
    const docId = uuidv4();

    // Simulate processing - estimate chunks based on content length
    const estimatedChunks = Math.ceil(validated.content.length / 1000);

    const document = await db.document.create({
      data: {
        id: docId,
        projectId: id,
        filename: validated.filename,
        originalName: validated.originalName,
        mimeType: validated.mimeType,
        size: validated.size,
        storageKey,
        status: 'uploaded',
        chunkCount: 0,
      },
    });

    // Simulate async document processing (chunking & embedding)
    // In a real app, this would be done via a queue/background job
    setTimeout(async () => {
      try {
        await db.document.update({
          where: { id: docId },
          data: {
            status: 'processed',
            chunkCount: estimatedChunks,
          },
        });

        // Create embedding records for chunks
        const chunks = [];
        for (let i = 0; i < Math.min(estimatedChunks, 5); i++) {
          chunks.push({
            id: uuidv4(),
            projectId: id,
            documentId: docId,
            chunkIndex: i,
            content: validated.content.slice(i * 1000, (i + 1) * 1000),
            embedding: JSON.stringify(new Array(1536).fill(0).map(() => Math.random())),
            metadata: JSON.stringify({ chunkIndex: i, documentId: docId }),
          });
        }

        if (chunks.length > 0) {
          await db.embedding.createMany({ data: chunks });
        }
      } catch (e) {
        console.error('Document processing error:', e);
      }
    }, 2000);

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    console.error('POST /api/projects/[id]/documents error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Erreur lors de l\'ajout du document' },
      { status: 500 }
    );
  }
}
