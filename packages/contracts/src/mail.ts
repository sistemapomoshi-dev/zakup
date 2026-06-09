import { z } from 'zod'

import { emailSchema } from './auth'

export const mailboxSyncStatusSchema = z.enum(['idle', 'syncing', 'error'])
export const emailLinkStatusSchema = z.enum(['auto', 'manual', 'unlinked'])
export const emailDirectionSchema = z.enum(['inbound', 'outbound'])

export const upsertMailboxRequestSchema = z.object({
  imapHost: z.string().trim().min(1).max(255),
  imapPort: z.coerce.number().int().positive().default(993),
  imapSecure: z.boolean().default(true),
  smtpHost: z.string().trim().min(1).max(255),
  smtpPort: z.coerce.number().int().positive().default(587),
  smtpSecure: z.boolean().default(false),
  email: emailSchema,
  login: z.string().trim().min(1).max(255),
  password: z.string().min(1).max(512),
})

export const mailboxConnectionNullableSchema = z
  .object({
    id: z.string().uuid(),
    email: emailSchema,
    login: z.string(),
    imapHost: z.string(),
    imapPort: z.number().int(),
    imapSecure: z.boolean(),
    smtpHost: z.string(),
    smtpPort: z.number().int(),
    smtpSecure: z.boolean(),
    syncStatus: mailboxSyncStatusSchema,
    lastSyncAt: z.string().datetime().nullable(),
    lastSyncError: z.string().nullable(),
    historyImportedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .nullable()

export const mailboxConnectionSchema = z.object({
  id: z.string().uuid(),
  email: emailSchema,
  login: z.string(),
  imapHost: z.string(),
  imapPort: z.number().int(),
  imapSecure: z.boolean(),
  smtpHost: z.string(),
  smtpPort: z.number().int(),
  smtpSecure: z.boolean(),
  syncStatus: mailboxSyncStatusSchema,
  lastSyncAt: z.string().datetime().nullable(),
  lastSyncError: z.string().nullable(),
  historyImportedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const mailboxSyncResultSchema = z.object({
  imported: z.number().int(),
  skipped: z.number().int(),
  linked: z.number().int(),
  historyComplete: z.boolean(),
})

export const attachmentParseStatusSchema = z.enum([
  'pending',
  'parsing',
  'parsed',
  'failed',
  'skipped',
])

export const parsedPriceSourceSchema = z.enum(['excel', 'csv', 'pdf', 'ocr'])

export const emailAttachmentSchema = z.object({
  id: z.string().uuid(),
  filename: z.string(),
  mimeType: z.string().nullable(),
  sizeBytes: z.number().int().nullable(),
  parseStatus: attachmentParseStatusSchema,
  parseError: z.string().nullable(),
  parsedAt: z.string().datetime().nullable(),
  rowCount: z.number().int(),
})

export const parsedPriceRowSchema = z.object({
  id: z.string().uuid(),
  attachmentId: z.string().uuid(),
  rowIndex: z.number().int(),
  sku: z.string().nullable(),
  name: z.string().nullable(),
  unit: z.string().nullable(),
  quantity: z.number().nullable(),
  price: z.number().nullable(),
  currency: z.string().nullable(),
  source: parsedPriceSourceSchema,
})

export const parsedPriceRowListResponseSchema = z.object({
  items: z.array(parsedPriceRowSchema),
})

export const attachmentDownloadResponseSchema = z.object({
  downloadUrl: z.string().url(),
  expiresAt: z.string().datetime(),
  filename: z.string(),
})

export const emailMessageSchema = z.object({
  id: z.string().uuid(),
  threadId: z.string().uuid(),
  messageId: z.string(),
  fromEmail: z.string().email(),
  fromName: z.string().nullable(),
  toEmails: z.array(z.string()),
  subject: z.string(),
  bodyText: z.string().nullable(),
  direction: emailDirectionSchema,
  sentAt: z.string().datetime(),
  hasAttachments: z.boolean(),
  attachments: z.array(emailAttachmentSchema),
})

export const emailThreadSchema = z.object({
  id: z.string().uuid(),
  supplierId: z.string().uuid().nullable(),
  subject: z.string(),
  linkStatus: emailLinkStatusSchema,
  lastMessageAt: z.string().datetime(),
  messageCount: z.number().int().optional(),
  previewFrom: z.string().nullable().optional(),
})

export const emailThreadListResponseSchema = z.object({
  items: z.array(emailThreadSchema),
})

export const emailMessageListResponseSchema = z.object({
  items: z.array(emailMessageSchema),
})

export const linkThreadRequestSchema = z.object({
  supplierId: z.string().uuid().nullable(),
})

export const mailSupplierIdParamsSchema = z.object({
  supplierId: z.string().uuid(),
})

export const mailAttachmentIdParamsSchema = z.object({
  attachmentId: z.string().uuid(),
})

export const mailThreadIdParamsSchema = z.object({
  threadId: z.string().uuid(),
})

export const reparseAttachmentResponseSchema = z.object({
  ok: z.literal(true),
})

export type UpsertMailboxRequest = z.input<typeof upsertMailboxRequestSchema>
export type UpsertMailboxPayload = z.output<typeof upsertMailboxRequestSchema>
export type MailboxConnectionDto = z.infer<typeof mailboxConnectionSchema>
export type MailboxSyncResult = z.infer<typeof mailboxSyncResultSchema>
export type EmailThreadDto = z.infer<typeof emailThreadSchema>
export type EmailAttachmentDto = z.infer<typeof emailAttachmentSchema>
export type ParsedPriceRowDto = z.infer<typeof parsedPriceRowSchema>
export type EmailMessageDto = z.infer<typeof emailMessageSchema>
