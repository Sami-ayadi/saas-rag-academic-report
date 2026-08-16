import { beforeEach, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'

import { createCsrfToken } from './lib/csrf'
import { proxy } from './proxy'

const secret = 'a-secure-test-secret-that-is-longer-than-thirty-two-characters'

beforeEach(() => {
  process.env.NEXTAUTH_SECRET = secret
  process.env.NEXTAUTH_URL = 'http://localhost:3000'
})

describe('API security proxy', () => {
  it('rejects cross-site mutations', () => {
    const request = new NextRequest('http://localhost:3000/api/projects', {
      method: 'POST',
      headers: { origin: 'https://attacker.example', 'sec-fetch-site': 'cross-site' },
    })
    expect(proxy(request).status).toBe(403)
  })

  it('rejects same-origin mutations without a CSRF token', () => {
    const request = new NextRequest('http://localhost:3000/api/projects', {
      method: 'POST',
      headers: { origin: 'http://localhost:3000', 'sec-fetch-site': 'same-origin' },
    })
    const response = proxy(request)
    expect(response.status).toBe(403)
    expect(response.headers.get('X-CSRF-Error')).toBe('1')
  })

  it('allows a same-origin mutation with matching signed tokens', () => {
    const token = createCsrfToken(secret)
    const request = new NextRequest('http://localhost:3000/api/projects', {
      method: 'POST',
      headers: {
        origin: 'http://localhost:3000',
        'sec-fetch-site': 'same-origin',
        'x-csrf-token': token,
        cookie: `rag-csrf=${token}`,
      },
    })
    expect(proxy(request).status).toBe(200)
  })

  it('adds a unique nonce-based CSP without allowing inline scripts', () => {
    const request = new NextRequest('http://localhost:3000/')
    const first = proxy(request).headers.get('Content-Security-Policy')
    const second = proxy(request).headers.get('Content-Security-Policy')

    expect(first).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/)
    expect(first).not.toMatch(/script-src[^;]*'unsafe-inline'/)
    expect(first).not.toBe(second)
  })
})
