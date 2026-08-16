import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { z } from 'zod/v4'

import { ApiRequestError, readJsonBody } from './api-input'

const schema = z.object({ name: z.string().max(20) }).strict()

describe('readJsonBody', () => {
  it('accepts bounded JSON matching the schema', async () => {
    const request = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Rapport' }),
    })
    await expect(readJsonBody(request, schema)).resolves.toEqual({ name: 'Rapport' })
  })

  it('rejects non-JSON content types', async () => {
    const request = new NextRequest('http://localhost/api/test', { method: 'POST', body: 'name=report' })
    await expect(readJsonBody(request, schema)).rejects.toMatchObject({ status: 415 } satisfies Partial<ApiRequestError>)
  })

  it('rejects bodies larger than the endpoint limit', async () => {
    const request = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'too long' }),
    })
    await expect(readJsonBody(request, schema, 4)).rejects.toMatchObject({ status: 413 } satisfies Partial<ApiRequestError>)
  })
})
