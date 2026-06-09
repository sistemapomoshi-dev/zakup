import type {

  EmailMessageDto,

  EmailThreadDto,

  ParsedPriceRowDto,

  UserDto,

} from '@web-app-demo/contracts'



import { reparseStoredAttachment } from './attachments/pipeline'
import { isLocalStorageKey } from './attachments/store'

import type { DbClient } from '../db'

import type { AppEnv } from '../env'

import { AppError } from '../http/errors'

import type { StorageService } from '../storage/service'



export class MailService {

  constructor(

    private readonly db: DbClient,

    private readonly env: AppEnv,

    private readonly storageService: StorageService | null = null,

  ) {}



  async listThreadsForSupplier(actor: UserDto, supplierId: string): Promise<EmailThreadDto[]> {

    await this.assertSupplierAccess(actor, supplierId)

    const threads = await this.db.emailThread.findMany({

      where: { mailboxUserId: actor.id, supplierId },

      orderBy: { lastMessageAt: 'desc' },

      include: {

        _count: { select: { messages: true } },

        messages: {

          orderBy: { sentAt: 'desc' },

          take: 1,

          select: { fromEmail: true, fromName: true },

        },

      },

    })

    return threads.map((thread) => ({

      id: thread.id,

      supplierId: thread.supplierId,

      subject: thread.subject,

      linkStatus: thread.linkStatus,

      lastMessageAt: thread.lastMessageAt.toISOString(),

      messageCount: thread._count.messages,

      previewFrom: thread.messages[0]?.fromName ?? thread.messages[0]?.fromEmail ?? null,

    }))

  }



  async listUnlinkedThreads(actor: UserDto): Promise<EmailThreadDto[]> {

    const threads = await this.db.emailThread.findMany({

      where: { mailboxUserId: actor.id, supplierId: null },

      orderBy: { lastMessageAt: 'desc' },

      take: 100,

      include: {

        _count: { select: { messages: true } },

        messages: {

          orderBy: { sentAt: 'desc' },

          take: 1,

          select: { fromEmail: true, fromName: true },

        },

      },

    })

    return threads.map((thread) => ({

      id: thread.id,

      supplierId: thread.supplierId,

      subject: thread.subject,

      linkStatus: thread.linkStatus,

      lastMessageAt: thread.lastMessageAt.toISOString(),

      messageCount: thread._count.messages,

      previewFrom: thread.messages[0]?.fromName ?? thread.messages[0]?.fromEmail ?? null,

    }))

  }



  async listMessages(actor: UserDto, threadId: string): Promise<EmailMessageDto[]> {

    const thread = await this.db.emailThread.findFirst({

      where: { id: threadId, mailboxUserId: actor.id },

    })

    if (!thread) {

      throw new AppError(404, 'NOT_FOUND', 'Thread not found')

    }



    const messages = await this.db.emailMessage.findMany({

      where: { threadId },

      orderBy: { sentAt: 'asc' },

      include: { attachments: true },

    })



    return messages.map((message) => ({

      id: message.id,

      threadId: message.threadId,

      messageId: message.messageId,

      fromEmail: message.fromEmail,

      fromName: message.fromName,

      toEmails: message.toEmails,

      subject: message.subject,

      bodyText: message.bodyText,

      direction: message.direction,

      sentAt: message.sentAt.toISOString(),

      hasAttachments: message.hasAttachments,

      attachments: message.attachments.map((attachment) => ({

        id: attachment.id,

        filename: attachment.filename,

        mimeType: attachment.mimeType,

        sizeBytes: attachment.sizeBytes,

        parseStatus: attachment.parseStatus,

        parseError: attachment.parseError,

        parsedAt: attachment.parsedAt?.toISOString() ?? null,

        rowCount: attachment.rowCount,

      })),

    }))

  }



  async listParsedRows(actor: UserDto, attachmentId: string): Promise<ParsedPriceRowDto[]> {

    await this.assertAttachmentAccess(actor, attachmentId)

    const rows = await this.db.parsedPriceRow.findMany({

      where: { attachmentId },

      orderBy: { rowIndex: 'asc' },

    })



    return rows.map((row) => ({

      id: row.id,

      attachmentId: row.attachmentId,

      rowIndex: row.rowIndex,

      sku: row.sku,

      name: row.name,

      unit: row.unit,

      quantity: row.quantity ? Number(row.quantity) : null,

      price: row.price ? Number(row.price) : null,

      currency: row.currency,

      source: row.source,

    }))

  }



  async createAttachmentDownload(actor: UserDto, attachmentId: string) {

    const attachment = await this.assertAttachmentAccess(actor, attachmentId)

    if (!attachment.storageKey) {

      throw new AppError(404, 'NOT_FOUND', 'Attachment file is not stored')

    }



    if (isLocalStorageKey(attachment.storageKey)) {
      throw new AppError(
        501,
        'INTERNAL_ERROR',
        'Direct download URLs are unavailable for local attachment storage in this environment',
      )
    }

    if (!this.storageService) {
      throw new AppError(503, 'INTERNAL_ERROR', 'Object storage is not configured')
    }



    const signed = await this.storageService.createDownloadUrl({ key: attachment.storageKey })

    return {

      downloadUrl: signed.downloadUrl,

      expiresAt: signed.expiresAt,

      filename: attachment.filename,

    }

  }



  async reparseAttachment(actor: UserDto, attachmentId: string) {

    await this.assertAttachmentAccess(actor, attachmentId)

    await reparseStoredAttachment(this.db, this.env, this.storageService, attachmentId)

    return { ok: true as const }

  }



  async linkThread(actor: UserDto, threadId: string, supplierId: string | null) {

    const thread = await this.db.emailThread.findFirst({

      where: { id: threadId, mailboxUserId: actor.id },

    })

    if (!thread) {

      throw new AppError(404, 'NOT_FOUND', 'Thread not found')

    }

    if (supplierId) {

      await this.assertSupplierAccess(actor, supplierId)

    }

    const updated = await this.db.emailThread.update({

      where: { id: threadId },

      data: {

        supplierId,

        linkStatus: supplierId ? 'manual' : 'unlinked',

      },

    })

    return {

      id: updated.id,

      supplierId: updated.supplierId,

      subject: updated.subject,

      linkStatus: updated.linkStatus,

      lastMessageAt: updated.lastMessageAt.toISOString(),

    }

  }



  private async assertAttachmentAccess(actor: UserDto, attachmentId: string) {

    const attachment = await this.db.emailAttachment.findUnique({

      where: { id: attachmentId },

      include: {

        message: {

          select: {

            mailboxUserId: true,

            thread: {

              select: {

                supplierId: true,

              },

            },

          },

        },

      },

    })



    if (!attachment || attachment.message.mailboxUserId !== actor.id) {

      throw new AppError(404, 'NOT_FOUND', 'Attachment not found')

    }



    const supplierId = attachment.message.thread.supplierId

    if (supplierId) {

      await this.assertSupplierAccess(actor, supplierId)

    }



    return attachment

  }



  private async assertSupplierAccess(actor: UserDto, supplierId: string) {

    const supplier = await this.db.supplier.findUnique({ where: { id: supplierId } })

    if (!supplier) {

      throw new AppError(404, 'NOT_FOUND', 'Supplier not found')

    }

    if (actor.role !== 'admin' && supplier.assignedManagerId !== actor.id) {

      throw new AppError(403, 'FORBIDDEN', 'Supplier is assigned to another manager')

    }

  }

}


