import { NextRequest, NextResponse } from 'next/server'
import type { ZodType } from 'zod/v4'

const DEFAULT_MAX_BYTES = 256_000

export class ApiRequestError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export async function readJsonBody<T>(
  request: NextRequest,
  schema: ZodType<T>,
  maxBytes = DEFAULT_MAX_BYTES,
): Promise<T> {
  const contentType = request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()
  if (contentType !== 'application/json') {
    throw new ApiRequestError(415, 'Content-Type application/json requis')
  }

  const declaredLength = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new ApiRequestError(413, 'Corps de requête trop volumineux')
  }

  const text = await request.text()
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new ApiRequestError(413, 'Corps de requête trop volumineux')
  }

  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new ApiRequestError(400, 'Corps JSON invalide')
  }

  return schema.parse(value)
}

export function apiRequestErrorResponse(error: unknown) {
  if (!(error instanceof ApiRequestError)) return null
  return NextResponse.json({ error: error.message }, { status: error.status })
}
