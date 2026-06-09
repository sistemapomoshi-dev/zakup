import { z } from 'zod'

export const emailDraftStatusSchema = z.enum([
  'draft',
  'pending_review',
  'approved',
  'rejected',
  'sent',
])

export const draftVersionSourceSchema = z.enum(['ai', 'user'])

export const draftVersionSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  bodyText: z.string(),
  source: draftVersionSourceSchema,
  createdById: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
})

export const emailDraftSchema = z.object({
  id: z.string().uuid(),
  supplierId: z.string().uuid(),
  supplierName: z.string(),
  negotiationId: z.string().uuid().nullable(),
  threadId: z.string().uuid().nullable(),
  triggerMessageId: z.string().uuid().nullable(),
  status: emailDraftStatusSchema,
  subject: z.string(),
  bodyText: z.string(),
  latestVersion: z.number().int(),
  approvedById: z.string().uuid().nullable(),
  approvedAt: z.string().datetime().nullable(),
  rejectedReason: z.string().nullable(),
  sentAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const emailDraftDetailSchema = emailDraftSchema.extend({
  versions: z.array(draftVersionSchema),
})

export const emailDraftListResponseSchema = z.object({
  items: z.array(emailDraftSchema),
})

export const updateDraftRequestSchema = z.object({
  subject: z.string().trim().min(1).max(500).optional(),
  bodyText: z.string().trim().min(1).max(50_000),
})

export const rejectDraftRequestSchema = z.object({
  reason: z.string().trim().min(1).max(2000),
})

export const draftIdParamsSchema = z.object({
  draftId: z.string().uuid(),
})

export const draftListQuerySchema = z.object({
  status: emailDraftStatusSchema.optional(),
  supplierId: z.string().uuid().optional(),
})

export type EmailDraftStatusDto = z.infer<typeof emailDraftStatusSchema>
export type EmailDraftDto = z.infer<typeof emailDraftSchema>
export type EmailDraftDetailDto = z.infer<typeof emailDraftDetailSchema>
export type UpdateDraftRequest = z.infer<typeof updateDraftRequestSchema>
export type RejectDraftRequest = z.infer<typeof rejectDraftRequestSchema>
