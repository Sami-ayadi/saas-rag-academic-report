import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { db } from './db'
import {
  applyTierChange,
  BILLABLE_TIERS,
  checkoutSessionParams,
  isBillingSimulationEnabled,
  isStripeConfigured,
  pickActiveSubscription,
  priceIdForTier,
  resolveTierFromPriceId,
} from './billing'

describe('stripe configuration helpers', () => {
  const originalKey = process.env.STRIPE_SECRET_KEY
  const originalStarter = process.env.STRIPE_PRICE_STARTER_ID
  const originalPro = process.env.STRIPE_PRICE_PRO_ID

  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = ''
    process.env.STRIPE_PRICE_STARTER_ID = ''
    process.env.STRIPE_PRICE_PRO_ID = ''
  })

  afterEach(() => {
    if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY
    else process.env.STRIPE_SECRET_KEY = originalKey
    if (originalStarter === undefined) delete process.env.STRIPE_PRICE_STARTER_ID
    else process.env.STRIPE_PRICE_STARTER_ID = originalStarter
    if (originalPro === undefined) delete process.env.STRIPE_PRICE_PRO_ID
    else process.env.STRIPE_PRICE_PRO_ID = originalPro
  })

  it('isStripeConfigured is false without a secret key', () => {
    expect(isStripeConfigured()).toBe(false)
  })

  it('isStripeConfigured is true with a secret key', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_xxx'
    expect(isStripeConfigured()).toBe(true)
  })

  it('priceIdForTier returns null without env var', () => {
    expect(priceIdForTier('STARTER')).toBeNull()
  })

  it('priceIdForTier returns the configured price id', () => {
    process.env.STRIPE_PRICE_STARTER_ID = 'price_starter_123'
    expect(priceIdForTier('STARTER')).toBe('price_starter_123')
  })

  it('resolveTierFromPriceId maps a known price back to its tier', () => {
    process.env.STRIPE_PRICE_STARTER_ID = 'price_starter_123'
    process.env.STRIPE_PRICE_PRO_ID = 'price_pro_456'
    expect(resolveTierFromPriceId('price_starter_123')).toBe('STARTER')
    expect(resolveTierFromPriceId('price_pro_456')).toBe('PRO')
    expect(resolveTierFromPriceId('unknown')).toBeNull()
    expect(resolveTierFromPriceId(null)).toBeNull()
  })

  it('BILLABLE_TIERS contains only STARTER and PRO', () => {
    expect(BILLABLE_TIERS).toEqual(['STARTER', 'PRO'])
  })
})

describe('checkoutSessionParams', () => {
  it('builds a subscription-mode session with server-owned price id', () => {
    const params = checkoutSessionParams(
      {
        userId: 'user_1',
        email: 'test@example.com',
        customerId: null,
        hasActiveSubscription: false,
        tier: 'FREE',
      },
      'price_starter_123',
      'http://localhost:3001',
    )
    expect(params.mode).toBe('subscription')
    expect(params.line_items).toEqual([{ price: 'price_starter_123', quantity: 1 }])
    expect(params.client_reference_id).toBe('user_1')
    expect(params.metadata).toEqual({ userId: 'user_1' })
    expect(params.success_url).toContain('billing=success')
    expect(params.cancel_url).toContain('billing=cancelled')
    expect(params.allow_promotion_codes).toBe(false)
  })

  it('uses customer id when present, else customer email', () => {
    const withCustomer = checkoutSessionParams(
      {
        userId: 'user_1',
        email: 'test@example.com',
        customerId: 'cus_123',
        hasActiveSubscription: true,
        tier: 'STARTER',
      },
      'price_pro_456',
      'http://localhost:3001',
    )
    expect(withCustomer.customer).toBe('cus_123')
    expect(withCustomer.customer_email).toBeUndefined()

    const withoutCustomer = checkoutSessionParams(
      {
        userId: 'user_1',
        email: 'test@example.com',
        customerId: null,
        hasActiveSubscription: false,
        tier: 'FREE',
      },
      'price_starter_123',
      'http://localhost:3001',
    )
    expect(withoutCustomer.customer).toBeUndefined()
    expect(withoutCustomer.customer_email).toBe('test@example.com')
  })
})

describe('isBillingSimulationEnabled', () => {
  const originalDemo = process.env.AUTH_ALLOW_DEMO
  const originalPublicDemo = process.env.NEXT_PUBLIC_AUTH_ALLOW_DEMO

  afterEach(() => {
    if (originalDemo === undefined) delete process.env.AUTH_ALLOW_DEMO
    else process.env.AUTH_ALLOW_DEMO = originalDemo
    if (originalPublicDemo === undefined) delete process.env.NEXT_PUBLIC_AUTH_ALLOW_DEMO
    else process.env.NEXT_PUBLIC_AUTH_ALLOW_DEMO = originalPublicDemo
  })

  it('is false when demo auth is not allowed', () => {
    process.env.AUTH_ALLOW_DEMO = 'false'
    process.env.NEXT_PUBLIC_AUTH_ALLOW_DEMO = 'false'
    expect(isBillingSimulationEnabled()).toBe(false)
  })

  it('is true when demo auth is allowed', () => {
    process.env.AUTH_ALLOW_DEMO = 'true'
    process.env.NEXT_PUBLIC_AUTH_ALLOW_DEMO = 'true'
    expect(isBillingSimulationEnabled()).toBe(true)
  })
})

describe('applyTierChange (requires database)', () => {
  const hasDb = Boolean(process.env.DATABASE_URL)
  const suffix = () => `t${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  it.runIf(hasDb)('applies a tier change and writes an audit log', async () => {
    const s = suffix()
    const user = await db.user.create({
      data: { email: `billing-${s}@test.local`, name: 'BT', tier: 'FREE', role: 'USER', creditsLimit: 3, creditsUsed: 0 },
      select: { id: true },
    })
    const updated = await applyTierChange(user.id, 'PRO', { source: 'simulation', actorId: user.id })
    expect(updated.tier).toBe('PRO')
    const audit = await db.adminAuditLog.findFirst({ where: { targetId: user.id, action: 'BILLING_TIER_CHANGE' }, orderBy: { createdAt: 'desc' } })
    expect(audit?.summary).toContain('FREE → PRO')
    await db.adminAuditLog.deleteMany({ where: { targetId: user.id } })
    await db.user.delete({ where: { id: user.id } }).catch(() => undefined)
  })

  it.runIf(hasDb)('downgrading to FREE clears the subscription id', async () => {
    const s = suffix()
    const user = await db.user.create({
      data: { email: `billing-down-${s}@test.local`, name: 'BD', tier: 'PRO', role: 'USER', creditsLimit: 20, creditsUsed: 0, stripeSubId: 'sub_old', stripeCustomerId: 'cus_old' },
      select: { id: true },
    })
    await applyTierChange(user.id, 'FREE', { source: 'stripe', subscriptionId: 'sub_old', customerId: 'cus_old' })
    const refreshed = await db.user.findUnique({ where: { id: user.id }, select: { stripeSubId: true } })
    expect(refreshed?.stripeSubId).toBeNull()
    await db.adminAuditLog.deleteMany({ where: { targetId: user.id } })
    await db.user.delete({ where: { id: user.id } }).catch(() => undefined)
  })

  it.runIf(hasDb)('persists price id and customer id from the event', async () => {
    const s = suffix()
    const user = await db.user.create({
      data: { email: `billing-meta-${s}@test.local`, name: 'BM', tier: 'FREE', role: 'USER', creditsLimit: 3, creditsUsed: 0 },
      select: { id: true },
    })
    await applyTierChange(user.id, 'STARTER', { source: 'stripe', priceId: 'price_starter', subscriptionId: 'sub_new', customerId: 'cus_new' })
    const r = await db.user.findUnique({ where: { id: user.id }, select: { tier: true, stripePriceId: true, stripeCustomerId: true, stripeSubId: true } })
    expect(r?.tier).toBe('STARTER')
    expect(r?.stripePriceId).toBe('price_starter')
    expect(r?.stripeCustomerId).toBe('cus_new')
    expect(r?.stripeSubId).toBe('sub_new')
    await db.adminAuditLog.deleteMany({ where: { targetId: user.id } })
    await db.user.delete({ where: { id: user.id } }).catch(() => undefined)
  })

  it.runIf(hasDb)('throws for an unknown user', async () => {
    await expect(applyTierChange('nonexistent_user_id', 'PRO', { source: 'simulation' })).rejects.toThrow(/unknown user/)
  })
})
describe('pickActiveSubscription (pull-based reconciliation helper)', () => {
  const mk = (id: string, status: string, created: number) => ({ id, status, created })

  it('returns null when every subscription is inactive', () => {
    expect(pickActiveSubscription([mk('s1', 'canceled', 100), mk('s2', 'past_due', 200)])).toBeNull()
  })

  it('returns the most recent active subscription, ignoring older ones', () => {
    const activeOlder = mk('s_old', 'active', 100)
    const activeNewer = mk('s_new', 'active', 300)
    const trialing = mk('s_trial', 'trialing', 200)
    expect(pickActiveSubscription([activeOlder, activeNewer, trialing])?.id).toBe('s_new')
  })

  it('prefers a trialing subscription over an older active one', () => {
    expect(pickActiveSubscription([mk('s_active', 'active', 100), mk('s_trial', 'trialing', 300)])?.id).toBe('s_trial')
  })

  it('returns null for an empty list', () => {
    expect(pickActiveSubscription([])).toBeNull()
  })
})
