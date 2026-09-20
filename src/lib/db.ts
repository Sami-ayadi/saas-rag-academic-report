import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Query logs are opt-in because production statements can reveal schema
    // details and create excessive worker output.
    log: process.env.PRISMA_LOG_QUERIES === 'true' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

export type DbTransaction = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>
