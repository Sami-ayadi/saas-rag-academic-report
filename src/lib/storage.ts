import { mkdir, rm, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_STORAGE_DIRECTORY = path.resolve(process.cwd(), 'storage')

export function storageRoot() {
  return path.resolve(/* turbopackIgnore: true */ process.env.PRIVATE_STORAGE_ROOT ?? DEFAULT_STORAGE_DIRECTORY)
}

export function safeStoragePath(...segments: string[]) {
  const root = storageRoot()
  const resolved = path.resolve(root, ...segments)
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error('Invalid storage path')
  }
  return resolved
}

export function uploadStorageKey(userId: string, projectId: string, filename: string) {
  return ['uploads', userId, projectId, filename].join('/')
}

export function exportStorageKey(userId: string, projectId: string, filename: string) {
  return ['exports', userId, projectId, filename].join('/')
}

export async function writePrivateFile(storageKey: string, bytes: Buffer) {
  const absolutePath = safeStoragePath(...storageKey.split('/'))
  await mkdir(path.dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, bytes, { flag: 'wx' })
  return absolutePath
}

export async function removePrivateFile(storageKey: string) {
  const absolutePath = safeStoragePath(...storageKey.split('/'))
  await unlink(absolutePath).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error
  })
}

export async function removeProjectStorage(userId: string, projectId: string) {
  for (const area of ['uploads', 'exports']) {
    const directory = safeStoragePath(area, userId, projectId)
    await rm(directory, { recursive: true, force: true })
  }
}
