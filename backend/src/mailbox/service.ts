import type {
  MailboxConnectionDto,
  MailboxSyncResult,
  UpsertMailboxPayload,
  UserDto,
} from '@web-app-demo/contracts'

import type { DbClient } from '../db'
import type { AppEnv } from '../env'
import { AppError } from '../http/errors'
import { encryptSecret } from '../mail/crypto'
import { syncMailboxForUser } from '../mail/sync'

type MailboxRecord = {
  id: string
  userId: string
  email: string
  login: string
  imapHost: string
  imapPort: number
  imapSecure: boolean
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  syncStatus: 'idle' | 'syncing' | 'error'
  lastSyncAt: Date | null
  lastSyncError: string | null
  historyImportedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

import type { StorageService } from '../storage/service'

export class MailboxService {
  constructor(
    private readonly db: DbClient,
    private readonly env: AppEnv,
    private readonly storageService: StorageService | null = null,
  ) {}

  async getForUser(userId: string): Promise<MailboxConnectionDto | null> {
    const mailbox = await this.db.mailboxConnection.findUnique({ where: { userId } })
    return mailbox ? toMailboxDto(mailbox) : null
  }

  async upsert(actor: UserDto, input: UpsertMailboxPayload): Promise<MailboxConnectionDto> {
    const passwordEncrypted = await encryptSecret(input.password, this.env.JWT_SECRET)
    const mailbox = await this.db.mailboxConnection.upsert({
      where: { userId: actor.id },
      create: {
        userId: actor.id,
        imapHost: input.imapHost,
        imapPort: input.imapPort,
        imapSecure: input.imapSecure,
        smtpHost: input.smtpHost,
        smtpPort: input.smtpPort,
        smtpSecure: input.smtpSecure,
        email: input.email,
        login: input.login,
        passwordEncrypted,
      },
      update: {
        imapHost: input.imapHost,
        imapPort: input.imapPort,
        imapSecure: input.imapSecure,
        smtpHost: input.smtpHost,
        smtpPort: input.smtpPort,
        smtpSecure: input.smtpSecure,
        email: input.email,
        login: input.login,
        passwordEncrypted,
        syncStatus: 'idle',
        lastSyncError: null,
      },
    })
    return toMailboxDto(mailbox)
  }

  async sync(actor: UserDto): Promise<MailboxSyncResult> {
    const mailbox = await this.db.mailboxConnection.findUnique({ where: { userId: actor.id } })
    if (!mailbox) {
      throw new AppError(404, 'NOT_FOUND', 'Mailbox is not configured')
    }
    if (mailbox.syncStatus === 'syncing') {
      throw new AppError(409, 'CONFLICT', 'Mailbox sync is already in progress')
    }
    return syncMailboxForUser(this.db, this.env, actor.id, this.storageService)
  }
}

function toMailboxDto(mailbox: MailboxRecord): MailboxConnectionDto {
  return {
    id: mailbox.id,
    email: mailbox.email,
    login: mailbox.login,
    imapHost: mailbox.imapHost,
    imapPort: mailbox.imapPort,
    imapSecure: mailbox.imapSecure,
    smtpHost: mailbox.smtpHost,
    smtpPort: mailbox.smtpPort,
    smtpSecure: mailbox.smtpSecure,
    syncStatus: mailbox.syncStatus,
    lastSyncAt: mailbox.lastSyncAt?.toISOString() ?? null,
    lastSyncError: mailbox.lastSyncError,
    historyImportedAt: mailbox.historyImportedAt?.toISOString() ?? null,
    createdAt: mailbox.createdAt.toISOString(),
    updatedAt: mailbox.updatedAt.toISOString(),
  }
}
