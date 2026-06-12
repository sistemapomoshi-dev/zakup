import type { Attachment } from 'mailparser'

import type { DbClient } from '../../db'
import type { AppEnv } from '../../env'
import type { StorageService } from '../../storage/service'
import { parseAttachmentContent } from './parse'
import { readAttachmentContent, storeAttachmentContent } from './store'

type PersistAttachmentInput = {
  messageId: string
  ownerId: string
  attachment: Attachment
}

function attachmentBuffer(attachment: Attachment) {
  const content = attachment.content as unknown
  if (Buffer.isBuffer(content)) {
    return content
  }
  if (content instanceof Uint8Array) {
    return Buffer.from(content)
  }
  return Buffer.from(String(content ?? ''), 'utf8')
}

export async function persistAndParseAttachment(
  db: DbClient,
  env: AppEnv,
  storageService: StorageService | null,
  input: PersistAttachmentInput,
) {
  const filename = input.attachment.filename || 'attachment'
  const mimeType = input.attachment.contentType ?? null
  const data = attachmentBuffer(input.attachment)
  const sizeBytes = input.attachment.size ?? data.byteLength

  if (sizeBytes > env.ATTACHMENT_MAX_BYTES) {
    await db.emailAttachment.create({
      data: {
        messageId: input.messageId,
        filename,
        mimeType,
        sizeBytes,
        parseStatus: 'skipped',
        parseError: `Вложение превышает лимит ${env.ATTACHMENT_MAX_BYTES} байт`,
        parsedAt: new Date(),
      },
    })
    return
  }

  const record = await db.emailAttachment.create({
    data: {
      messageId: input.messageId,
      filename,
      mimeType,
      sizeBytes,
      parseStatus: 'parsing',
    },
  })

  try {
    const storageKey = await storeAttachmentContent(env, storageService, {
      ownerId: input.ownerId,
      filename,
      mimeType,
      data,
    })

    const parseResult = await parseAttachmentContent(filename, mimeType, data, {
      tesseractBin: env.OCR_TESSERACT_BIN,
      tesseractLang: env.OCR_TESSERACT_LANG,
    })

    if (parseResult.status === 'parsed') {
      await db.$transaction(async (tx) => {
        await tx.parsedPriceRow.createMany({
          data: parseResult.rows.map((row) => ({
            attachmentId: record.id,
            rowIndex: row.rowIndex,
            sku: row.sku,
            name: row.name,
            unit: row.unit,
            quantity: row.quantity,
            price: row.price,
            currency: row.currency,
            source: row.source,
            rawValues: row.rawValues,
          })),
        })
        await tx.emailAttachment.update({
          where: { id: record.id },
          data: {
            storageKey,
            parseStatus: 'parsed',
            parseError: null,
            parsedAt: new Date(),
            rowCount: parseResult.rows.length,
          },
        })
      })
      return
    }

    await db.emailAttachment.update({
      where: { id: record.id },
      data: {
        storageKey,
        parseStatus: parseResult.status === 'skipped' ? 'skipped' : 'failed',
        parseError: parseResult.status === 'skipped' ? parseResult.reason : parseResult.error,
        parsedAt: parseResult.status === 'skipped' ? new Date() : null,
        rowCount: 0,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to store attachment'
    await db.emailAttachment.update({
      where: { id: record.id },
      data: {
        parseStatus: 'failed',
        parseError: message,
      },
    })
  }
}

export async function reparseStoredAttachment(
  db: DbClient,
  env: AppEnv,
  storageService: StorageService | null,
  attachmentId: string,
) {
  const attachment = await db.emailAttachment.findUnique({
    where: { id: attachmentId },
  })
  if (!attachment?.storageKey) {
    throw new Error('Attachment file is not stored')
  }

  await db.emailAttachment.update({
    where: { id: attachmentId },
    data: { parseStatus: 'parsing', parseError: null },
  })

  const data = await readAttachmentContent(env, storageService, attachment.storageKey)
  const parseResult = await parseAttachmentContent(attachment.filename, attachment.mimeType, data, {
    tesseractBin: env.OCR_TESSERACT_BIN,
    tesseractLang: env.OCR_TESSERACT_LANG,
  })

  if (parseResult.status === 'parsed') {
    await db.$transaction(async (tx) => {
      await tx.parsedPriceRow.deleteMany({ where: { attachmentId } })
      await tx.parsedPriceRow.createMany({
        data: parseResult.rows.map((row) => ({
          attachmentId,
          rowIndex: row.rowIndex,
          sku: row.sku,
          name: row.name,
          unit: row.unit,
          quantity: row.quantity,
          price: row.price,
          currency: row.currency,
          source: row.source,
          rawValues: row.rawValues,
        })),
      })
      await tx.emailAttachment.update({
        where: { id: attachmentId },
        data: {
          parseStatus: 'parsed',
          parseError: null,
          parsedAt: new Date(),
          rowCount: parseResult.rows.length,
        },
      })
    })
    return
  }

  await db.$transaction(async (tx) => {
    await tx.parsedPriceRow.deleteMany({ where: { attachmentId } })
    await tx.emailAttachment.update({
      where: { id: attachmentId },
      data: {
        parseStatus: parseResult.status === 'skipped' ? 'skipped' : 'failed',
        parseError: parseResult.status === 'skipped' ? parseResult.reason : parseResult.error,
        parsedAt: parseResult.status === 'skipped' ? new Date() : null,
        rowCount: 0,
      },
    })
  })
}
