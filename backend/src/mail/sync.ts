import { ImapFlow } from 'imapflow'
import { simpleParser, type AddressObject, type Attachment } from 'mailparser'

import { processInboundMessage } from '../ai/pipeline'
import { persistAndParseAttachment } from './attachments/pipeline'
import type { DbClient } from '../db'
import type { AppEnv } from '../env'
import type { StorageService } from '../storage/service'
import { decryptSecret } from './crypto'
import { buildThreadKey, findSupplierForEmail } from './linking'

type MailboxRecord = {
  id: string
  userId: string
  imapHost: string
  imapPort: number
  imapSecure: boolean
  email: string
  login: string
  passwordEncrypted: string
  historyImportedAt: Date | null
}

export type MailSyncResult = {
  imported: number
  skipped: number
  linked: number
  historyComplete: boolean
}

const BATCH_SIZE = 50

function listAddresses(input: AddressObject | AddressObject[] | undefined) {
  if (!input) return []
  if (Array.isArray(input)) {
    return input.flatMap((group) => group.value ?? [])
  }
  return input.value ?? []
}

function firstAddress(input: AddressObject | AddressObject[] | undefined) {
  return listAddresses(input)[0]
}

export async function syncMailboxForUser(
  db: DbClient,
  env: AppEnv,
  userId: string,
  storageService: StorageService | null = null,
): Promise<MailSyncResult> {
  const mailbox = await db.mailboxConnection.findUnique({ where: { userId } })
  if (!mailbox) {
    throw new Error('Mailbox is not configured')
  }

  await db.mailboxConnection.update({
    where: { id: mailbox.id },
    data: { syncStatus: 'syncing', lastSyncError: null },
  })

  try {
    const result = await syncMailbox(db, env, mailbox, storageService)
    await db.mailboxConnection.update({
      where: { id: mailbox.id },
      data: {
        syncStatus: 'idle',
        lastSyncAt: new Date(),
        lastSyncError: null,
        historyImportedAt: result.historyComplete
          ? mailbox.historyImportedAt ?? new Date()
          : mailbox.historyImportedAt,
      },
    })
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown sync error'
    await db.mailboxConnection.update({
      where: { id: mailbox.id },
      data: { syncStatus: 'error', lastSyncError: message },
    })
    throw error
  }
}

async function syncMailbox(
  db: DbClient,
  env: AppEnv,
  mailbox: MailboxRecord,
  storageService: StorageService | null,
): Promise<MailSyncResult> {
  const password = await decryptSecret(mailbox.passwordEncrypted, env.JWT_SECRET)
  const client = new ImapFlow({
    host: mailbox.imapHost,
    port: mailbox.imapPort,
    secure: mailbox.imapSecure,
    auth: { user: mailbox.login, pass: password },
    logger: false,
  })

  let imported = 0
  let skipped = 0
  let linked = 0
  const isFullHistory = mailbox.historyImportedAt === null

  await client.connect()
  try {
    const lock = await client.getMailboxLock('INBOX')
    try {
      const searchQuery = isFullHistory ? { all: true } : { seen: false }
      const uids = await client.search(searchQuery, { uid: true })
      const uidList = Array.isArray(uids) ? uids : []

      for (let i = 0; i < uidList.length; i += BATCH_SIZE) {
        const batch = uidList.slice(i, i + BATCH_SIZE)
        for await (const message of client.fetch(batch, {
          uid: true,
          envelope: true,
          source: true,
          internalDate: true,
        })) {
          if (!message.source) continue

          const parsed = await simpleParser(message.source)
          const messageId = parsed.messageId?.trim()
          if (!messageId) {
            skipped += 1
            continue
          }

          const existing = await db.emailMessage.findUnique({
            where: {
              mailboxUserId_messageId: {
                mailboxUserId: mailbox.userId,
                messageId,
              },
            },
            select: { id: true },
          })
          if (existing) {
            skipped += 1
            continue
          }

          const from = firstAddress(parsed.from)
          const fromEmail = (from?.address ?? 'unknown@local').toLowerCase()
          const fromName = from?.name ?? null
          const toEmails = listAddresses(parsed.to).map((entry) => entry.address ?? '').filter(Boolean)
          const subject = parsed.subject?.trim() || '(без темы)'
          const sentAt = parsed.date ?? message.internalDate ?? new Date()
          const inReplyTo = parsed.inReplyTo?.trim() || null
          const threadKey = buildThreadKey(messageId, inReplyTo, subject)
          const direction = fromEmail === mailbox.email.toLowerCase() ? 'outbound' : 'inbound'

          let supplierId: string | null = null
          let linkStatus: 'auto' | 'unlinked' = 'unlinked'
          if (direction === 'inbound') {
            supplierId = await findSupplierForEmail(db, mailbox.userId, fromEmail)
            if (supplierId) {
              linkStatus = 'auto'
              linked += 1
            }
          }

          const thread = await db.emailThread.upsert({
            where: {
              mailboxUserId_threadKey: {
                mailboxUserId: mailbox.userId,
                threadKey,
              },
            },
            create: {
              mailboxUserId: mailbox.userId,
              threadKey,
              subject,
              supplierId,
              linkStatus: supplierId ? linkStatus : 'unlinked',
              lastMessageAt: sentAt,
            },
            update: {
              subject,
              lastMessageAt: sentAt,
              ...(supplierId
                ? { supplierId, linkStatus }
                : {}),
            },
          })

          const emailMessage = await db.emailMessage.create({
            data: {
              threadId: thread.id,
              mailboxUserId: mailbox.userId,
              imapUid: message.uid,
              messageId,
              inReplyTo,
              fromEmail,
              fromName,
              toEmails,
              subject,
              bodyText: parsed.text?.trim() || null,
              bodyHtml: parsed.html ? String(parsed.html) : null,
              direction,
              sentAt,
              hasAttachments: (parsed.attachments?.length ?? 0) > 0,
            },
          })

          if (parsed.attachments?.length) {
            for (const attachment of parsed.attachments as Attachment[]) {
              await persistAndParseAttachment(db, env, storageService, {
                messageId: emailMessage.id,
                ownerId: mailbox.userId,
                attachment,
              })
            }
          }

          if (
            direction === 'inbound' &&
            supplierId &&
            !isFullHistory &&
            env.AI_AUTO_ANALYZE
          ) {
            void processInboundMessage(db, env, {
              supplierId,
              threadId: thread.id,
              triggerMessageId: emailMessage.id,
              mailboxUserId: mailbox.userId,
            }).catch((error) => {
              console.warn(`AI pipeline failed for message ${emailMessage.id}:`, error)
            })
          }

          imported += 1
        }
      }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout()
  }

  return {
    imported,
    skipped,
    linked,
    historyComplete: isFullHistory || mailbox.historyImportedAt !== null,
  }
}
