import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      tier: 'FREE' | 'STARTER' | 'PRO'
      role: 'USER' | 'ADMIN'
    } & DefaultSession['user']
  }

  interface User {
    tier: 'FREE' | 'STARTER' | 'PRO'
    role: 'USER' | 'ADMIN'
    isActive: boolean
  }
}
