import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { cookies } from 'next/headers'
import { getServerSession, type NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

import { db } from '@/lib/db'
import { isDemoAuthAllowed } from '@/lib/auth-policy'
import { notifyAdministrators } from '@/lib/notifications'

export const DEMO_STUDENT_ID = 'demo-user-001'
export const DEMO_ADMIN_ID = 'demo-admin-001'
export const DEMO_REVIEWER_ID = 'demo-admin-002'
export const DEMO_USER_COOKIE = 'rag-demo-user'
export const DEMO_USER_IDS = [DEMO_STUDENT_ID, DEMO_ADMIN_ID, DEMO_REVIEWER_ID] as const

function configuredPlatformOwnerEmails() {
  return new Set(
    (process.env.PLATFORM_OWNER_EMAILS ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  )
}

const googleClientId = process.env.GOOGLE_CLIENT_ID
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET

/**
 * True only when both Google OAuth credentials are present. When false, the
 * Google provider is not registered at all, so the client never shows a
 * sign-in button that would fail with NextAuth error `OAuthSignin`
 * ("Try signing in with a different account").
 */
export const isGoogleAuthConfigured = Boolean(googleClientId && googleClientSecret)

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  session: {
    strategy: 'database',
  },
  providers: isGoogleAuthConfigured && googleClientId && googleClientSecret
    ? [GoogleProvider({ clientId: googleClientId, clientSecret: googleClientSecret })]
    : [],
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
      const isBootstrapOwner = Boolean(user.email && configuredPlatformOwnerEmails().has(user.email.toLowerCase()))
      const persistedUser = isBootstrapOwner && user.role !== 'ADMIN'
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
  events: {
    async createUser({ user }) {
      await notifyAdministrators({
        type: 'USER_ENROLLED',
        title: 'Nouvel utilisateur inscrit',
        message: `${user.name ?? user.email ?? user.id} vient de rejoindre la plateforme.`,
        linkView: 'admin',
        metadata: { userId: user.id },
      }, [user.id])
    },
  },
}

export interface AuthenticatedUser {
  id: string
  tier: 'FREE' | 'STARTER' | 'PRO'
  role: 'USER' | 'ADMIN'
  isActive: boolean
  /** Administrator-managed override of the tier's monthly generation credits. */
  creditsLimit: number
}

export async function ensureDemoUsers() {
  if (!isDemoAuthAllowed(process.env)) return

  await Promise.all([
    db.user.upsert({
      where: { id: DEMO_STUDENT_ID },
      update: { isActive: true, birthDate: new Date('2002-04-12'), gender: 'Femme' },
      create: {
        id: DEMO_STUDENT_ID,
        email: 'demo@rapportgen.fr',
        name: 'Étudiant Démo',
        birthDate: new Date('2002-04-12'),
        gender: 'Femme',
        tier: 'PRO',
        role: 'USER',
        isActive: true,
        creditsLimit: 50,
      },
    }),
    db.user.upsert({
      where: { id: DEMO_REVIEWER_ID },
      update: { isActive: true, birthDate: new Date('1988-09-03'), gender: 'Homme' },
      create: {
        id: DEMO_REVIEWER_ID,
        email: 'reviewer.demo@rapportgen.fr',
        name: 'Validateur Démo',
        birthDate: new Date('1988-09-03'),
        gender: 'Homme',
        tier: 'PRO',
        role: 'ADMIN',
        isActive: true,
        creditsLimit: 999,
      },
    }),
    db.user.upsert({
      where: { id: DEMO_ADMIN_ID },
      update: { isActive: true, birthDate: new Date('1994-01-22'), gender: 'Non-binaire' },
      create: {
        id: DEMO_ADMIN_ID,
        email: 'admin.demo@rapportgen.fr',
        name: 'Administrateur Démo',
        birthDate: new Date('1994-01-22'),
        gender: 'Non-binaire',
        tier: 'PRO',
        role: 'ADMIN',
        isActive: true,
        creditsLimit: 999,
      },
    }),
  ])

  const sessionNow = new Date()
  await Promise.all([
    { token: 'demo-session-student', userId: DEMO_STUDENT_ID, minutes: 42 },
    { token: 'demo-session-owner', userId: DEMO_ADMIN_ID, minutes: 18 },
    { token: 'demo-session-reviewer', userId: DEMO_REVIEWER_ID, minutes: 27 },
  ].map((session) => db.session.upsert({
    where: { sessionToken: session.token },
    update: { expires: new Date(sessionNow.getTime() + 8 * 60 * 60_000), lastSeenAt: sessionNow },
    create: {
      sessionToken: session.token, userId: session.userId,
      expires: new Date(sessionNow.getTime() + 8 * 60 * 60_000),
      createdAt: new Date(sessionNow.getTime() - session.minutes * 60_000), lastSeenAt: sessionNow,
    },
  })))

  await db.notification.upsert({
    where: { id: 'demo-notification-student-welcome' }, update: {},
    create: {
      id: 'demo-notification-student-welcome', userId: DEMO_STUDENT_ID, type: 'WELCOME',
      title: 'Bienvenue dans votre espace', message: 'Vos projets et rapports sont prêts à être consultés.', linkView: 'dashboard',
    },
  })
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
      select: { id: true, tier: true, role: true, isActive: true, creditsLimit: true },
    })
  }

  const session = await getServerSession(authOptions)
  if (session?.user?.id) {
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, tier: true, role: true, isActive: true, creditsLimit: true },
    })
    if (user?.isActive) {
      const cookieStore = await cookies()
      const sessionToken = cookieStore.get('__Secure-next-auth.session-token')?.value
        ?? cookieStore.get('next-auth.session-token')?.value
      if (sessionToken) await db.session.updateMany({ where: { sessionToken }, data: { lastSeenAt: new Date() } })
      return user
    }
    return null
  }

  return null
}

export async function isPlatformOwner(userId: string) {
  if (isDemoAuthAllowed(process.env) && userId === DEMO_ADMIN_ID) return true
  const ownerEmails = configuredPlatformOwnerEmails()
  if (ownerEmails.size === 0) return false
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } })
  return Boolean(user?.email && ownerEmails.has(user.email.toLowerCase()))
}
