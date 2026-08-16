import { describe, expect, it } from 'vitest'

import { isDemoAuthAllowed } from './auth-policy'

describe('isDemoAuthAllowed', () => {
  it('requires an explicit opt-in during development', () => {
    expect(isDemoAuthAllowed({ NODE_ENV: 'development' })).toBe(false)
    expect(isDemoAuthAllowed({ NODE_ENV: 'development', AUTH_ALLOW_DEMO: 'true' })).toBe(true)
  })

  it('can never enable demo authentication in production', () => {
    expect(isDemoAuthAllowed({ NODE_ENV: 'production', AUTH_ALLOW_DEMO: 'true' })).toBe(false)
  })

  it('treats non-exact values as disabled', () => {
    expect(isDemoAuthAllowed({ NODE_ENV: 'test', AUTH_ALLOW_DEMO: 'TRUE' })).toBe(false)
    expect(isDemoAuthAllowed({ NODE_ENV: 'test', AUTH_ALLOW_DEMO: '1' })).toBe(false)
  })
})
