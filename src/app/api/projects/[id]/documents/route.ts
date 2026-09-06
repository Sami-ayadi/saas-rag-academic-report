import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'

import { db } from '@/lib/db'
import { getAuthenticatedUser } from '@/lib/auth'
import { apiRequestErrorResponse, readJsonBody } from '@/lib/api-input'
import { resolveEntitlements } from '@/lib/entitlements'

export const runtime = 'nodejs'

const ALLOWED_FILES = {
  '.pdf': ['application/pdf'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.txt': ['text/plain'],
  '.md': ['text/markdown', 'text/plain'],
} as const

const deleteDocumentSchema = z.object({
  documentId: z.string().trim().min(1).max(100),
}).strict()

function storageRoot() {
  return path.resolve(process.cwd(), 'storage', 'uploads')
}

function safeStoragePath(...segments: string[]) {
  const root = storageRoot()
  const resolved = path.resolve(root, ...segments)
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error('Invalid storage path')
  }
  return resolved
}

function hasValidSignature(extension: keyof typeof ALLOWED_FILES, bytes: Buffer) {
  if (extension === '.pdf') return bytes.subarray(0, 5).toString('ascii') === '%PDF-'
  if (extension === '.docx') return bytes[0] === 0x50 && bytes[1] === 0x4b
  return !bytes.includes(0)
}

function extractText(extension: keyof typeof ALLOWED_FILES, bytes: Buffer) {
  if (extension !== '.txt' && extension !== '.md') return ''
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes).replace(/\0/g, '').slice(0, 250_000)
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const user = await getAuthenticatedUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const project = await db.project.findFirst({ where: { id, userId: user.id }, select: { id: true } })
    if (!project) return NextResponse.json({ error: 'Projet non trouvé' }, { status: 404 })

    const documents = await db.document.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ documents })
  } catch (error) {
    console.error('GET /api/projects/[id]/documents error:', error)
    return NextResponse.json({ error: 'Erreur lors de la récupération des documents' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let storedAbsolutePath: string | undefined
  try {
    const { id } = await params
    const user = await getAuthenticatedUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const project = await db.project.findFirst({ where: { id, userId: user.id }, select: { id: true } })
    if (!project) return NextResponse.json({ error: 'Projet non trouvé' }, { status: 404 })

    // Entitlements are resolved from the persisted account, never from the request.
    const entitlements = resolveEntitlements(user)
    const documentsInProject = await db.document.count({ where: { projectId: id } })
    if (documentsInProject >= entitlements.documentsPerProject) {
      return NextResponse.json(
        {
          error: `Votre plan autorise ${entitlements.documentsPerProject} document(s) par projet.`,
          code: 'DOCUMENT_LIMIT_REACHED',
        },
        { status: 402 },
      )
    }

    const contentType = request.headers.get('content-type') ?? ''
    if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
      return NextResponse.json({ error: 'Envoyez le fichier avec multipart/form-data' }, { status: 415 })
    }

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
    if (!file.name || file.name.length > 180 || /[\\/\0]/.test(file.name)) {
      return NextResponse.json({ error: 'Nom de fichier invalide' }, { status: 400 })
    }
    if (file.size <= 0 || file.size > entitlements.maxUploadBytes) {
      return NextResponse.json(
        {
          error: `Le fichier doit faire moins de ${Math.round(entitlements.maxUploadBytes / (1024 * 1024))} Mo`,
          code: 'FILE_TOO_LARGE',
        },
        { status: 413 },
      )
    }

    const extension = path.extname(file.name).toLowerCase() as keyof typeof ALLOWED_FILES
    const allowedMimes = ALLOWED_FILES[extension]
    if (!allowedMimes || !(allowedMimes as readonly string[]).includes(file.type)) {
      return NextResponse.json({ error: 'Formats acceptés : PDF, DOCX, TXT et Markdown' }, { status: 415 })
    }

    const bytes = Buffer.from(await file.arrayBuffer())
    if (!hasValidSignature(extension, bytes)) {
      return NextResponse.json({ error: 'Le contenu du fichier ne correspond pas à son format' }, { status: 400 })
    }

    const storedName = `${crypto.randomUUID()}${extension}`
    const relativeStorageKey = ['storage', 'uploads', user.id, id, storedName].join('/')
    const targetDirectory = safeStoragePath(user.id, id)
    storedAbsolutePath = safeStoragePath(user.id, id, storedName)
    await mkdir(targetDirectory, { recursive: true })
    await writeFile(storedAbsolutePath, bytes, { flag: 'wx' })

    const text = extractText(extension, bytes)
    const chunks = text.match(/[\s\S]{1,1500}/g)?.slice(0, 100) ?? []
    const documentId = crypto.randomUUID()
    const document = await db.$transaction(async (transaction) => {
      const created = await transaction.document.create({
        data: {
          id: documentId,
          projectId: id,
          filename: storedName,
          originalName: file.name,
          mimeType: file.type,
          size: file.size,
          storageKey: relativeStorageKey,
          status: chunks.length ? 'processed' : 'stored',
          chunkCount: chunks.length,
        },
      })
      if (chunks.length) {
        await transaction.embedding.createMany({
          data: chunks.map((content, chunkIndex) => ({
            id: crypto.randomUUID(),
            projectId: id,
            documentId,
            chunkIndex,
            content,
            embedding: '[]',
            metadata: JSON.stringify({ documentId, chunkIndex, source: file.name }),
          })),
        })
      }
      return created
    })

    return NextResponse.json({ document }, { status: 201 })
  } catch (error) {
    if (storedAbsolutePath) await unlink(storedAbsolutePath).catch(() => undefined)
    console.error('POST /api/projects/[id]/documents error:', error)
    return NextResponse.json({ error: 'Erreur lors de l’enregistrement du document' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const user = await getAuthenticatedUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    const { documentId } = await readJsonBody(request, deleteDocumentSchema)

    const document = await db.document.findFirst({
      where: { id: documentId, projectId: id, project: { userId: user.id } },
    })
    if (!document) return NextResponse.json({ error: 'Document non trouvé' }, { status: 404 })

    await db.$transaction([
      db.embedding.deleteMany({ where: { documentId: document.id, projectId: id } }),
      db.document.delete({ where: { id: document.id } }),
    ])
    const absolutePath = safeStoragePath(user.id, id, document.filename)
    await unlink(absolutePath).catch(() => undefined)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/projects/[id]/documents error:', error)
    const requestError = apiRequestErrorResponse(error)
    if (requestError) return requestError
    return NextResponse.json({ error: 'Erreur lors de la suppression du document' }, { status: 500 })
  }
}
