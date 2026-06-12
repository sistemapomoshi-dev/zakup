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
    files: z.number().int(),
  }),
})

export const moyskladSyncResultSchema = z.object({
  counterparties: z.number().int(),
  products: z.number().int(),
  purchaseOrders: z.number().int(),
  purchasePositions: z.number().int(),
  files: z.number().int(),
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

export const moyskladPriceSuggestionStatusSchema = z.enum(['suggested', 'confirmed', 'rejected'])

export const moyskladPriceSuggestionSchema = z.object({
  id: z.string().uuid(),
  parsedRowId: z.string().uuid(),
  supplierId: z.string().uuid().nullable(),
  productId: z.string(),
  productName: z.string(),
  sku: z.string().nullable(),
  name: z.string().nullable(),
  suggestedPrice: z.number(),
  currentPrice: z.number().nullable(),
  priceDelta: z.number().nullable(),
  currency: z.string(),
  status: moyskladPriceSuggestionStatusSchema,
  confirmedById: z.string().uuid().nullable(),
  confirmedAt: z.string().datetime().nullable(),
  rejectedAt: z.string().datetime().nullable(),
  rejectionReason: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const moyskladPriceSuggestionListResponseSchema = z.object({
  items: z.array(moyskladPriceSuggestionSchema),
})

export const moyskladPriceSuggestionIdParamsSchema = z.object({
  suggestionId: z.string().uuid(),
})

export const moyskladPriceSuggestionListQuerySchema = z.object({
  status: moyskladPriceSuggestionStatusSchema.optional(),
  supplierId: z.string().uuid().optional(),
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
export type MoySkladPriceSuggestionStatusDto = z.infer<typeof moyskladPriceSuggestionStatusSchema>
export type MoySkladPriceSuggestionDto = z.infer<typeof moyskladPriceSuggestionSchema>
