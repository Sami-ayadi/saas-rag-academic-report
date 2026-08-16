import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { cookies } from 'next/headers'
import { getServerSession, type NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

import { db } from '@/lib/db'
import { isDemoAuthAllowed } from '@/lib/auth-policy'

export const DEMO_STUDENT_ID = 'demo-user-001'
export const DEMO_ADMIN_ID = 'demo-admin-001'
export const DEMO_USER_COOKIE = 'rag-demo-user'
export const DEMO_USER_IDS = [DEMO_STUDENT_ID, DEMO_ADMIN_ID] as const

function configuredAdminEmails() {
  return new Set(
    (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  )
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  session: {
    strategy: 'database',
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false
      const existing = await db.user.findUnique({
        where: { email: user.email },
        select: { isActive: true },
      })
      return existing?.isActive ?? true
    },
    async session({ session, user }) {
      const shouldBeAdmin = Boolean(user.email && configuredAdminEmails().has(user.email.toLowerCase()))
      const persistedUser = shouldBeAdmin && user.role !== 'ADMIN'
        ? await db.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } })
        : user

      if (session.user) {
        session.user.id = persistedUser.id
        session.user.tier = persistedUser.tier
        session.user.role = persistedUser.role
      }
      return session
    },
  },
}

export interface AuthenticatedUser {
  id: string
  tier: 'FREE' | 'STARTER' | 'PRO'
  role: 'USER' | 'ADMIN'
  isActive: boolean
}

export async function ensureDemoUsers() {
  if (!isDemoAuthAllowed(process.env)) return

  await Promise.all([
    db.user.upsert({
      where: { id: DEMO_STUDENT_ID },
      update: { role: 'USER', isActive: true },
      create: {
        id: DEMO_STUDENT_ID,
        email: 'demo@rapportgen.fr',
        name: 'Étudiant Démo',
        tier: 'PRO',
        role: 'USER',
        isActive: true,
        creditsLimit: 50,
      },
    }),
    db.user.upsert({
      where: { id: DEMO_ADMIN_ID },
      update: { role: 'ADMIN', isActive: true },
      create: {
        id: DEMO_ADMIN_ID,
        email: 'admin.demo@rapportgen.fr',
        name: 'Administrateur Démo',
        tier: 'PRO',
        role: 'ADMIN',
        isActive: true,
        creditsLimit: 999,
      },
    }),
  ])
}

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  if (isDemoAuthAllowed(process.env)) {
    await ensureDemoUsers()
    const cookieStore = await cookies()
    const selectedId = cookieStore.get(DEMO_USER_COOKIE)?.value
    const demoUserId = DEMO_USER_IDS.includes(selectedId as typeof DEMO_USER_IDS[number])
      ? selectedId!
      : DEMO_STUDENT_ID
    return db.user.findUnique({
      where: { id: demoUserId },
      select: { id: true, tier: true, role: true, isActive: true },
    })
  }

  const session = await getServerSession(authOptions)
  if (session?.user?.id) {
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, tier: true, role: true, isActive: true },
    })
    return user?.isActive ? user : null
  }

  return null
}
