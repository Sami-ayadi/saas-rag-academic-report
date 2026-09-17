import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // PRODUCTION: use a pooled URL, direct migration URL, and redacted query
    // telemetry; confirm logs cannot contain report or personal data.
    log: ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

export type DbTransaction = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>
