import { NextRequest, NextResponse } from 'next/server'

import { csrfCookieName, verifyCsrfToken } from './lib/csrf'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const MAX_API_BODY_BYTES = 1_500_000
const MAX_UPLOAD_BODY_BYTES = 10_500_000
const RATE_WINDOW_MS = 60_000

interface RateEntry {
  count: number
  resetAt: number
}

const globalRateStore = globalThis as typeof globalThis & {
  __ragRateLimits?: Map<string, RateEntry>
}
const rateLimits = globalRateStore.__ragRateLimits ?? new Map<string, RateEntry>()
globalRateStore.__ragRateLimits = rateLimits

function clientKey(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || request.headers.get('x-real-ip') || 'local'
}

function requestLimit(request: NextRequest) {
  const path = request.nextUrl.pathname
  if (/generate|regenerate|export/.test(path)) return 10
  return SAFE_METHODS.has(request.method) ? 180 : 60
}

function checkRateLimit(request: NextRequest) {
  const now = Date.now()
  const key = `${clientKey(request)}:${request.nextUrl.pathname}:${SAFE_METHODS.has(request.method) ? 'read' : 'write'}`
  const current = rateLimits.get(key)
  const entry = !current || current.resetAt <= now
    ? { count: 1, resetAt: now + RATE_WINDOW_MS }
    : { count: current.count + 1, resetAt: current.resetAt }
  rateLimits.set(key, entry)

  if (rateLimits.size > 5_000) {
    for (const [candidateKey, candidate] of rateLimits) {
      if (candidate.resetAt <= now) rateLimits.delete(candidateKey)
    }
  }

  return {
    allowed: entry.count <= requestLimit(request),
    remaining: Math.max(0, requestLimit(request) - entry.count),
    resetAt: entry.resetAt,
  }
}

function allowedOrigins(request: NextRequest) {
  return new Set([
    request.nextUrl.origin,
    process.env.NEXTAUTH_URL,
    process.env.APP_URL,
  ].filter((value): value is string => Boolean(value)))
}

function contentSecurityPolicy(nonce: string) {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self'${process.env.NODE_ENV === 'development' ? ' ws: wss:' : ''}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
  ].join('; ')
}

function applyCsp(response: NextResponse, nonce: string) {
  response.headers.set('Content-Security-Policy', contentSecurityPolicy(nonce))
  return response
}

function securityFailure(message: string, status: number, nonce: string, csrf = false) {
  const response = NextResponse.json({ error: message }, { status })
  if (csrf) response.headers.set('X-CSRF-Error', '1')
  return applyCsp(response, nonce)
}

export function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID()
  const path = request.nextUrl.pathname
  const isApi = path.startsWith('/api/')
  let rate: ReturnType<typeof checkRateLimit> | undefined

  if (isApi) {
    rate = checkRateLimit(request)
    if (!rate.allowed) {
      const response = securityFailure('Trop de requêtes', 429, nonce)
      response.headers.set('Retry-After', String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))))
      return response
    }

    const contentLength = Number(request.headers.get('content-length') ?? '0')
    const bodyLimit = request.method === 'POST' && path.endsWith('/documents')
      ? MAX_UPLOAD_BODY_BYTES
      : MAX_API_BODY_BYTES
    if (contentLength > bodyLimit) {
      return securityFailure('Corps de requête trop volumineux', 413, nonce)
    }
  }

  const isUnsafe = !SAFE_METHODS.has(request.method)
  const isAuthRoute = path.startsWith('/api/auth/')
  const isCsrfRoute = path === '/api/security/csrf'
  // SECURITY INVARIANT EXCEPTION (documented): /api/webhooks/stripe is the only
  // CSRF-exempt mutating route. Its caller is Stripe's infrastructure, not a
  // browser, so it has no CSRF token or same-origin headers by design. The
  // alternative authenticity check is mandatory: the route rejects any request
  // whose `stripe-signature` HMAC does not verify against the raw body with
  // STRIPE_WEBHOOK_SECRET (see src/app/api/webhooks/stripe/route.ts).
  const isStripeWebhook = path === '/api/webhooks/stripe'

  if (isApi && isUnsafe && !isAuthRoute && !isCsrfRoute && !isStripeWebhook) {
    const fetchSite = request.headers.get('sec-fetch-site')
    if (fetchSite === 'cross-site') return securityFailure('Origine interdite', 403, nonce, true)

    const origin = request.headers.get('origin')
    if (!origin || !allowedOrigins(request).has(origin)) {
      return securityFailure('Origine interdite', 403, nonce, true)
    }

    const secret = process.env.NEXTAUTH_SECRET
    const headerToken = request.headers.get('x-csrf-token') ?? undefined
    const cookieToken = request.cookies.get(csrfCookieName())?.value
    if (!secret || headerToken !== cookieToken || !verifyCsrfToken(headerToken, secret)) {
      return securityFailure('Jeton CSRF invalide', 403, nonce, true)
    }
  }

  const requestHeaders = new Headers(request.headers)
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID()
  requestHeaders.set('x-request-id', requestId)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', contentSecurityPolicy(nonce))

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('X-Request-Id', requestId)
  if (rate) response.headers.set('X-RateLimit-Remaining', String(rate.remaining))
  if (isApi && !path.startsWith('/api/pricing')) response.headers.set('Cache-Control', 'private, no-store')
  return applyCsp(response, nonce)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt).*)'],
}
