import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { AppEnv } from '../../env'
import { createStorageObjectKey, type StorageService } from '../../storage/service'

const localStoragePrefix = 'local/'

export function resolveAttachmentLocalRoot(env: AppEnv) {
  const configured = env.ATTACHMENT_LOCAL_DIR?.trim()
  if (configured) {
    return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured)
  }
  return path.resolve(process.cwd(), '.data/attachments')
}

export function isLocalStorageKey(storageKey: string) {
  return storageKey.startsWith(localStoragePrefix)
}

export async function storeAttachmentContent(
  env: AppEnv,
  storageService: StorageService | null,
  input: {
    ownerId: string
    filename: string
    mimeType: string | null
    data: Buffer
  },
) {
  if (storageService) {
    const key = createStorageObjectKey({
      namespace: 'mail-attachments',
      ownerId: input.ownerId,
      filename: input.filename,
    })
    await storageService.putObject({
      key,
      body: input.data,
      contentType: input.mimeType ?? 'application/octet-stream',
      visibility: 'private',
    })
    return key
  }

  const key = createStorageObjectKey({
    namespace: 'mail-attachments',
    ownerId: input.ownerId,
    filename: input.filename,
  })
  const relativeKey = `${localStoragePrefix}${key}`
  const absolutePath = path.join(resolveAttachmentLocalRoot(env), key)
  await mkdir(path.dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, input.data)
  return relativeKey
}

export async function readAttachmentContent(
  env: AppEnv,
  storageService: StorageService | null,
  storageKey: string,
) {
  if (isLocalStorageKey(storageKey)) {
    const absolutePath = path.join(resolveAttachmentLocalRoot(env), storageKey.slice(localStoragePrefix.length))
    return readFile(absolutePath)
  }

  if (!storageService) {
    throw new Error('Object storage is not configured for remote attachment')
  }

  return storageService.getObject(storageKey)
}
