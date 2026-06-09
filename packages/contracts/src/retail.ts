import { z } from 'zod'



export const marketplaceSchema = z.enum([

  'wildberries',

  'ozon',

  'yandex_market',

  'megamarket',

  'aliexpress',

  'website',

])



export const productMarketLinkSourceSchema = z.enum(['auto_barcode', 'auto_article', 'manual'])



export const retailStatusSchema = z.object({

  enabled: z.boolean(),

  targetMarginPercent: z.number(),

  lastFullSyncAt: z.string().datetime().nullable(),

  lastError: z.string().nullable(),

  counts: z.object({

    links: z.number().int(),

    snapshots: z.number().int(),

    productsWithRetail: z.number().int(),

  }),

})



export const retailSyncResultSchema = z.object({

  linksProcessed: z.number().int(),

  snapshotsSaved: z.number().int(),

  linksCreated: z.number().int(),

})



export const retailPriceSnapshotSchema = z.object({

  marketplace: marketplaceSchema,

  price: z.number(),

  originalPrice: z.number().nullable(),

  currency: z.string(),

  fetchedAt: z.string().datetime(),

  productUrl: z.string().nullable(),

})



export const retailMarkupSchema = z.object({

  medianPrice: z.number().nullable(),

  snapshots: z.array(retailPriceSnapshotSchema),

  markupPercent: z.number().nullable(),

  marginPercent: z.number().nullable(),

  maxWholesaleAtTargetMargin: z.number().nullable(),

  targetMarginPercent: z.number(),

  isLowMargin: z.boolean(),

  lastSyncedAt: z.string().datetime().nullable(),

})



export const productMarketLinkSchema = z.object({

  id: z.string().uuid(),

  productId: z.string(),

  marketplace: marketplaceSchema,

  externalId: z.string().nullable(),

  productUrl: z.string().nullable(),

  title: z.string().nullable(),

  source: productMarketLinkSourceSchema,

  isActive: z.boolean(),

  latestPrice: z.number().nullable(),

  latestFetchedAt: z.string().datetime().nullable(),

  createdAt: z.string().datetime(),

  updatedAt: z.string().datetime(),

})



export const productMarketLinkListResponseSchema = z.object({

  items: z.array(productMarketLinkSchema),

})



export const createProductMarketLinkRequestSchema = z.object({

  marketplace: marketplaceSchema,

  productUrl: z.string().url().optional(),

  externalId: z.string().min(1).optional(),

  title: z.string().min(1).optional(),

})



export const productMarketLinkParamsSchema = z.object({

  productId: z.string().min(1),

})



export const marketLinkIdParamsSchema = z.object({

  linkId: z.string().uuid(),

})



export type MarketplaceDto = z.infer<typeof marketplaceSchema>

export type RetailStatusDto = z.infer<typeof retailStatusSchema>

export type RetailSyncResultDto = z.infer<typeof retailSyncResultSchema>

export type RetailMarkupDto = z.infer<typeof retailMarkupSchema>

export type ProductMarketLinkDto = z.infer<typeof productMarketLinkSchema>

export type CreateProductMarketLinkRequest = z.infer<typeof createProductMarketLinkRequestSchema>

