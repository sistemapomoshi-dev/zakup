import { z } from 'zod'

import { retailMarkupSchema } from './retail'

export const moyskladStatusSchema = z.object({
  configured: z.boolean(),
  lastFullSyncAt: z.string().datetime().nullable(),
  lastCounterpartiesSyncAt: z.string().datetime().nullable(),
  lastProductsSyncAt: z.string().datetime().nullable(),
  lastPurchaseOrdersSyncAt: z.string().datetime().nullable(),
  lastError: z.string().nullable(),
  counts: z.object({
    counterparties: z.number().int(),
    products: z.number().int(),
    purchaseOrders: z.number().int(),
  }),
})

export const moyskladSyncResultSchema = z.object({
  counterparties: z.number().int(),
  products: z.number().int(),
  purchaseOrders: z.number().int(),
  purchasePositions: z.number().int(),
  linkedSuppliers: z.number().int(),
})

export const priceComparisonRowSchema = z.object({
  parsedRowId: z.string().uuid(),
  rowIndex: z.number().int(),
  sku: z.string().nullable(),
  name: z.string().nullable(),
  parsedPrice: z.number().nullable(),
  matchedProduct: z
    .object({
      id: z.string(),
      name: z.string(),
      code: z.string().nullable(),
      article: z.string().nullable(),
    })
    .nullable(),
  matchType: z.enum(['code', 'article', 'barcode', 'name']).nullable(),
  matchConfidence: z.number().nullable(),
  ourLastPurchasePrice: z.number().nullable(),
  ourLastPurchaseAt: z.string().datetime().nullable(),
  priceDelta: z.number().nullable(),
  priceDeltaPercent: z.number().nullable(),
  retail: retailMarkupSchema.nullable(),
})

export const priceComparisonListResponseSchema = z.object({
  items: z.array(priceComparisonRowSchema),
})

export const moyskladAttachmentComparisonParamsSchema = z.object({
  attachmentId: z.string().uuid(),
})

export const moyskladAttachmentComparisonQuerySchema = z.object({
  supplierId: z.string().uuid().optional(),
})

export type MoySkladStatusDto = z.infer<typeof moyskladStatusSchema>
export type MoySkladSyncResultDto = z.infer<typeof moyskladSyncResultSchema>
export type PriceComparisonRowDto = z.infer<typeof priceComparisonRowSchema>
