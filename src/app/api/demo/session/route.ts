import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'

import { db } from '@/lib/db'
import {
  DEMO_ADMIN_ID,
  DEMO_REVIEWER_ID,
  DEMO_STUDENT_ID,
  DEMO_USER_COOKIE,
  ensureDemoUsers,
} from '@/lib/auth'
import { isDemoAuthAllowed } from '@/lib/auth-policy'
import { apiRequestErrorResponse, readJsonBody } from '@/lib/api-input'

export const runtime = 'nodejs'

const switchDemoUserSchema = z.object({
  userId: z.enum([DEMO_STUDENT_ID, DEMO_ADMIN_ID, DEMO_REVIEWER_ID]),
}).strict()

export async function POST(request: NextRequest) {
  try {
    if (!isDemoAuthAllowed(process.env)) {
      return NextResponse.json({ error: 'Endpoint indisponible' }, { status: 404 })
    }

    const { userId } = await readJsonBody(request, switchDemoUserSchema)
    await ensureDemoUsers()
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, tier: true, role: true },
    })
    if (!user) return NextResponse.json({ error: 'Utilisateur démo introuvable' }, { status: 404 })

    const response = NextResponse.json({ user })
    response.cookies.set(DEMO_USER_COOKIE, user.id, {
      httpOnly: true,
      sameSite: 'strict',
      secure: false,
      path: '/',
      maxAge: 60 * 60 * 8,
    })
    return response
  } catch (error) {
    const requestError = apiRequestErrorResponse(error)
    if (requestError) return requestError
    console.error('POST /api/demo/session error:', error)
    return NextResponse.json({ error: 'Impossible de changer de compte démo' }, { status: 500 })
  }
}
