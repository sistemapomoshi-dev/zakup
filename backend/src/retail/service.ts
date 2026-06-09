import type { DbClient } from '../db'

import type { AppEnv } from '../env'

import { AppError } from '../http/errors'

import type { MarketplaceDto, ProductMarketLinkDto } from '@web-app-demo/contracts'

import type { Marketplace, ProductMarketLinkSource } from '../generated/prisma/enums'

import { retailConfigFromEnv } from './config'

import { syncRetailPrices } from './sync'



export class RetailService {

  constructor(

    private readonly db: DbClient,

    private readonly env: AppEnv,

  ) {}



  isEnabled() {
    return this.env.RETAIL_SYNC_ENABLED
  }



  async getStatus() {

    const config = retailConfigFromEnv(this.env)

    const state = await this.db.retailSyncState.findUnique({ where: { id: 'default' } })

    const [links, snapshots, productsWithRetail] = await Promise.all([

      this.db.productMarketLink.count({ where: { isActive: true } }),

      this.db.retailPriceSnapshot.count(),

      this.db.productMarketLink.groupBy({

        by: ['productId'],

        where: { isActive: true },

      }),

    ])



    return {

      enabled: this.isEnabled(),

      targetMarginPercent: config.targetMarginPercent,

      lastFullSyncAt: state?.lastFullSyncAt?.toISOString() ?? null,

      lastError: state?.lastError ?? null,

      counts: {

        links,

        snapshots,

        productsWithRetail: productsWithRetail.length,

      },

    }

  }



  async syncAll() {

    if (!this.isEnabled()) {

      throw new AppError(503, 'INTERNAL_ERROR', 'Retail price sync is disabled')

    }



    const config = retailConfigFromEnv(this.env)



    try {

      const result = await syncRetailPrices(this.db, config)

      await this.db.retailSyncState.upsert({

        where: { id: 'default' },

        create: {

          id: 'default',

          lastFullSyncAt: new Date(),

          linksSynced: result.linksProcessed,

          snapshotsSaved: result.snapshotsSaved,

          lastError: null,

        },

        update: {

          lastFullSyncAt: new Date(),

          linksSynced: result.linksProcessed,

          snapshotsSaved: result.snapshotsSaved,

          lastError: null,

        },

      })

      return result

    } catch (error) {

      const message = error instanceof Error ? error.message : 'Retail sync failed'

      await this.db.retailSyncState.upsert({

        where: { id: 'default' },

        create: { id: 'default', lastError: message },

        update: { lastError: message },

      })

      throw new AppError(502, 'INTERNAL_ERROR', message)

    }

  }



  async listProductLinks(productId: string) {

    await this.assertProductExists(productId)

    const links = await this.db.productMarketLink.findMany({

      where: { productId },

      orderBy: [{ marketplace: 'asc' }, { createdAt: 'asc' }],

      include: {

        snapshots: {

          orderBy: { fetchedAt: 'desc' },

          take: 1,

        },

      },

    })



    return links.map((link) => serializeLink(link))

  }



  async createProductLink(

    productId: string,

    input: {
      marketplace: Marketplace
      productUrl?: string
      externalId?: string
      title?: string
    },

  ) {

    await this.assertProductExists(productId)



    if (!input.productUrl && !input.externalId) {

      throw new AppError(400, 'VALIDATION_ERROR', 'productUrl or externalId is required')

    }



    const link = await this.db.productMarketLink.create({

      data: {

        productId,

        marketplace: input.marketplace,

        productUrl: input.productUrl ?? null,

        externalId: input.externalId ?? null,

        title: input.title ?? null,

        source: 'manual' satisfies ProductMarketLinkSource,

      },

      include: {

        snapshots: {

          orderBy: { fetchedAt: 'desc' },

          take: 1,

        },

      },

    })



    if (this.isEnabled()) {

      await syncRetailPrices(this.db, retailConfigFromEnv(this.env), { productIds: [productId] })

    }



    const refreshed = await this.db.productMarketLink.findUnique({

      where: { id: link.id },

      include: {

        snapshots: {

          orderBy: { fetchedAt: 'desc' },

          take: 1,

        },

      },

    })



    return serializeLink(refreshed ?? link)

  }



  async deleteLink(linkId: string) {

    const link = await this.db.productMarketLink.findUnique({ where: { id: linkId } })

    if (!link) {

      throw new AppError(404, 'NOT_FOUND', 'Market link not found')

    }



    await this.db.productMarketLink.delete({ where: { id: linkId } })

  }



  private async assertProductExists(productId: string) {

    const product = await this.db.moySkladProduct.findUnique({ where: { id: productId } })

    if (!product) {

      throw new AppError(404, 'NOT_FOUND', 'Product not found')

    }

  }

}



function serializeLink(link: {
  id: string
  productId: string
  marketplace: Marketplace
  externalId: string | null
  productUrl: string | null
  title: string | null
  source: ProductMarketLinkSource
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  snapshots: Array<{ price: unknown; fetchedAt: Date }>
}): ProductMarketLinkDto {
  const latest = link.snapshots[0]
  return {
    id: link.id,
    productId: link.productId,
    marketplace: link.marketplace as MarketplaceDto,
    externalId: link.externalId,
    productUrl: link.productUrl,
    title: link.title,
    source: link.source as ProductMarketLinkDto['source'],
    isActive: link.isActive,
    latestPrice: latest ? Number(latest.price) : null,
    latestFetchedAt: latest?.fetchedAt.toISOString() ?? null,
    createdAt: link.createdAt.toISOString(),
    updatedAt: link.updatedAt.toISOString(),
  }
}


