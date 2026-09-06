import type { Prisma } from '@prisma/client'

import { db } from './db'

type DatabaseClient = typeof db | Prisma.TransactionClient

export interface NotificationInput {
  userId: string
  type: string
  title: string
  message: string
  linkView?: string
  metadata?: Prisma.InputJsonValue
}

export async function createNotification(input: NotificationInput, client: DatabaseClient = db) {
  return client.notification.create({ data: input })
}

export async function notifyAdministrators(
  input: Omit<NotificationInput, 'userId'>,
  excludedUserIds: string[] = [],
  client: DatabaseClient = db,
) {
  const administrators = await client.user.findMany({
    where: { role: 'ADMIN', isActive: true, id: { notIn: excludedUserIds } },
    select: { id: true },
  })
  if (administrators.length === 0) return { count: 0 }
  return client.notification.createMany({ data: administrators.map(({ id }) => ({ ...input, userId: id })) })
}
