import { describe, expect, it } from 'vitest'

import { createCsrfToken, verifyCsrfToken } from './csrf'

const secret = 'a-secure-test-secret-that-is-longer-than-thirty-two-characters'

describe('CSRF tokens', () => {
  it('accepts a valid signed token', () => {
    const token = createCsrfToken(secret)
    expect(verifyCsrfToken(token, secret)).toBe(true)
  })

  it('rejects tampering and malformed tokens', () => {
    const token = createCsrfToken(secret)
    expect(verifyCsrfToken(`${token}x`, secret)).toBe(false)
    expect(verifyCsrfToken('invalid', secret)).toBe(false)
  })

  it('rejects weak secrets', () => {
    expect(() => createCsrfToken('short')).toThrow()
    expect(verifyCsrfToken('token.signature', 'short')).toBe(false)
  })
})
