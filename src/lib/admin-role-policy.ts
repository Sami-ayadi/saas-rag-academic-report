export function canRequestRoleChange(input: {
  requesterIsPlatformOwner: boolean
  currentRole: 'USER' | 'ADMIN'
  requestedRole: 'USER' | 'ADMIN'
}) {
  if (input.currentRole === input.requestedRole) return false
  return input.requestedRole !== 'ADMIN' || input.requesterIsPlatformOwner
}

export function canReviewRoleChange(input: {
  reviewerId: string
  requestedById: string
  targetUserId: string
}) {
  return input.reviewerId !== input.requestedById && input.reviewerId !== input.targetUserId
}
