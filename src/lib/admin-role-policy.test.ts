import { describe, expect, it } from 'vitest'

import { canRequestRoleChange, canReviewRoleChange } from './admin-role-policy'

describe('admin role approval policy', () => {
  it('reserves admin promotion requests to the platform owner', () => {
    expect(canRequestRoleChange({ requesterIsPlatformOwner: false, currentRole: 'USER', requestedRole: 'ADMIN' })).toBe(false)
    expect(canRequestRoleChange({ requesterIsPlatformOwner: true, currentRole: 'USER', requestedRole: 'ADMIN' })).toBe(true)
  })

  it('allows admins to request demotions', () => {
    expect(canRequestRoleChange({ requesterIsPlatformOwner: false, currentRole: 'ADMIN', requestedRole: 'USER' })).toBe(true)
  })

  it('requires an independent reviewer', () => {
    expect(canReviewRoleChange({ reviewerId: 'author', requestedById: 'author', targetUserId: 'target' })).toBe(false)
    expect(canReviewRoleChange({ reviewerId: 'target', requestedById: 'author', targetUserId: 'target' })).toBe(false)
    expect(canReviewRoleChange({ reviewerId: 'reviewer', requestedById: 'author', targetUserId: 'target' })).toBe(true)
  })
})
