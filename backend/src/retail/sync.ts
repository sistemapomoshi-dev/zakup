import type { DbClient } from '../db'

import type { ProductMarketLinkSource } from '../generated/prisma/enums'

import { createRetailAdapters, type RetailMarketplaceAdapter } from './adapters'

import type { RetailConfig } from './config'



export type RetailSyncResult = {

  linksProcessed: number

  snapshotsSaved: number

  linksCreated: number

}



type ProductCandidate = {

  id: string

  name: string

  article: string | null

  barcodes: string[]

}



export async function syncRetailPrices(

  db: DbClient,

  config: RetailConfig,

  options?: { productIds?: string[] },

): Promise<RetailSyncResult> {

  const adapters = createRetailAdapters(config.requestTimeoutMs)

  const products = await db.moySkladProduct.findMany({

    where: options?.productIds?.length ? { id: { in: options.productIds } } : undefined,

    select: {

      id: true,

      name: true,

      article: true,

      barcodes: true,

    },

  })



  let linksCreated = 0

  let linksProcessed = 0

  let snapshotsSaved = 0



  for (const product of products) {

    const created = await ensureAutoLinks(db, adapters, product)

    linksCreated += created

  }



  const links = await db.productMarketLink.findMany({

    where: {

      isActive: true,

      ...(options?.productIds?.length ? { productId: { in: options.productIds } } : {}),

    },

  })



  for (const link of links) {

    const adapter = adapters.find((item) => item.marketplace === link.marketplace)

    if (!adapter) continue



    try {

      const quote = await adapter.fetchPrice({

        externalId: link.externalId,

        productUrl: link.productUrl,

      })

      if (!quote) continue



      await db.productMarketLink.update({

        where: { id: link.id },

        data: {

          title: quote.title ?? link.title,

          productUrl: quote.productUrl ?? link.productUrl,

        },

      })



      await db.retailPriceSnapshot.create({

        data: {

          linkId: link.id,

          price: quote.price,

          originalPrice: quote.originalPrice,

          currency: quote.currency,

        },

      })



      linksProcessed += 1

      snapshotsSaved += 1

    } catch (error) {

      console.warn(`Retail sync failed for link ${link.id}:`, error)

    }

  }



  return { linksProcessed, snapshotsSaved, linksCreated }

}



async function ensureAutoLinks(

  db: DbClient,

  adapters: RetailMarketplaceAdapter[],

  product: ProductCandidate,

) {

  let created = 0

  const barcode = product.barcodes[0] ?? null

  const article = product.article ?? null

  if (!barcode && !article) return created



  for (const adapter of adapters) {

    const existing = await db.productMarketLink.findUnique({

      where: {

        productId_marketplace: {

          productId: product.id,

          marketplace: adapter.marketplace,

        },

      },

    })

    if (existing) continue



    try {

      const hit = await adapter.searchProduct({

        barcode,

        article,

        name: product.name,

      })

      if (!hit) continue



      const source: ProductMarketLinkSource = barcode ? 'auto_barcode' : 'auto_article'

      await db.productMarketLink.create({

        data: {

          productId: product.id,

          marketplace: adapter.marketplace,

          externalId: hit.externalId,

          productUrl: hit.productUrl,

          title: hit.title,

          source,

        },

      })

      created += 1

    } catch (error) {

      console.warn(`Retail auto-link failed for product ${product.id} on ${adapter.marketplace}:`, error)

    }

  }



  return created

}


