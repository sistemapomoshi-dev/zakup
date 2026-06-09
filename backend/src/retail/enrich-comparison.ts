import type { MarketplaceDto } from '@web-app-demo/contracts'

import type { DbClient } from '../db'
import type { AppEnv } from '../env'
import type { PriceComparisonRow } from '../moysklad/compare'
import { retailConfigFromEnv } from './config'
import { computeMarkup } from './markup'

type LatestSnapshot = {
  marketplace: MarketplaceDto
  price: number
  originalPrice: number | null
  currency: string
  fetchedAt: Date
  productUrl: string | null
}

export async function enrichComparisonWithRetail(
  db: DbClient,
  env: AppEnv,
  rows: PriceComparisonRow[],
): Promise<PriceComparisonRow[]> {
  const config = retailConfigFromEnv(env)
  const productIds = [
    ...new Set(rows.map((row) => row.matchedProduct?.id).filter((id): id is string => Boolean(id))),
  ]

  if (productIds.length === 0) {
    return rows.map((row) => ({ ...row, retail: null }))
  }

  const latestByProduct = await loadLatestSnapshotsByProduct(db, productIds)

  return rows.map((row) => {
    if (!row.matchedProduct) {
      return { ...row, retail: null }
    }

    const snapshots = latestByProduct.get(row.matchedProduct.id) ?? []
    if (snapshots.length === 0) {
      return {
        ...row,
        retail: {
          medianPrice: null,
          snapshots: [],
          markupPercent: null,
          marginPercent: null,
          maxWholesaleAtTargetMargin: null,
          targetMarginPercent: config.targetMarginPercent,
          isLowMargin: false,
          lastSyncedAt: null,
        },
      }
    }

    const markup = computeMarkup({
      wholesalePrice: row.parsedPrice,
      retailPrices: snapshots.map((snapshot) => snapshot.price),
      targetMarginPercent: config.targetMarginPercent,
    })

    const lastSyncedAt = snapshots.reduce<Date | null>((latest, snapshot) => {
      if (!latest || snapshot.fetchedAt > latest) return snapshot.fetchedAt
      return latest
    }, null)

    return {
      ...row,
      retail: {
        medianPrice: markup.medianPrice,
        snapshots: snapshots.map((snapshot) => ({
          marketplace: snapshot.marketplace,
          price: snapshot.price,
          originalPrice: snapshot.originalPrice,
          currency: snapshot.currency,
          fetchedAt: snapshot.fetchedAt.toISOString(),
          productUrl: snapshot.productUrl,
        })),
        markupPercent: markup.markupPercent,
        marginPercent: markup.marginPercent,
        maxWholesaleAtTargetMargin: markup.maxWholesaleAtTargetMargin,
        targetMarginPercent: config.targetMarginPercent,
        isLowMargin: markup.isLowMargin,
        lastSyncedAt: lastSyncedAt?.toISOString() ?? null,
      },
    }
  })
}

async function loadLatestSnapshotsByProduct(db: DbClient, productIds: string[]) {
  const links = await db.productMarketLink.findMany({
    where: {
      productId: { in: productIds },
      isActive: true,
    },
    include: {
      snapshots: {
        orderBy: { fetchedAt: 'desc' },
        take: 1,
      },
    },
  })

  const latestByProduct = new Map<string, LatestSnapshot[]>()

  for (const link of links) {
    const snapshot = link.snapshots[0]
    if (!snapshot) continue

    const entry: LatestSnapshot = {
      marketplace: link.marketplace as MarketplaceDto,
      price: Number(snapshot.price),
      originalPrice: snapshot.originalPrice ? Number(snapshot.originalPrice) : null,
      currency: snapshot.currency,
      fetchedAt: snapshot.fetchedAt,
      productUrl: link.productUrl,
    }

    const list = latestByProduct.get(link.productId) ?? []
    list.push(entry)
    latestByProduct.set(link.productId, list)
  }

  return latestByProduct
}
