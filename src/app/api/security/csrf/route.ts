import { NextResponse } from 'next/server'

import { createCsrfToken, csrfCookieName } from '@/lib/csrf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Configuration de sécurité incomplète' }, { status: 503 })
  }

  try {
    const token = createCsrfToken(secret)
    const response = NextResponse.json({ token })
    response.cookies.set(csrfCookieName(), token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60,
    })
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (error) {
    console.error('GET /api/security/csrf error:', error)
    return NextResponse.json({ error: 'Configuration de sécurité invalide' }, { status: 503 })
  }
}
