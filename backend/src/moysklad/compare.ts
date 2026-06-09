import type { RetailMarkupDto } from '@web-app-demo/contracts'

import type { DbClient } from '../db'
import { AppError } from '../http/errors'
import { matchProduct, computePriceDelta, type ProductMatchCandidate } from './match'

export type PriceComparisonRow = {
  parsedRowId: string
  rowIndex: number
  sku: string | null
  name: string | null
  parsedPrice: number | null
  matchedProduct: {
    id: string
    name: string
    code: string | null
    article: string | null
  } | null
  matchType: 'code' | 'article' | 'barcode' | 'name' | null
  matchConfidence: number | null
  ourLastPurchasePrice: number | null
  ourLastPurchaseAt: string | null
  priceDelta: number | null
  priceDeltaPercent: number | null
  retail: RetailMarkupDto | null
}

export async function compareAttachmentPrices(
  db: DbClient,
  attachmentId: string,
  supplierId: string | null,
): Promise<PriceComparisonRow[]> {
  const attachment = await db.emailAttachment.findUnique({
    where: { id: attachmentId },
    include: {
      parsedRows: { orderBy: { rowIndex: 'asc' } },
      message: {
        select: {
          thread: {
            select: { supplierId: true },
          },
        },
      },
    },
  })

  if (!attachment) {
    throw new AppError(404, 'NOT_FOUND', 'Attachment not found')
  }

  const effectiveSupplierId = supplierId ?? attachment.message.thread.supplierId
  const supplier = effectiveSupplierId
    ? await db.supplier.findUnique({ where: { id: effectiveSupplierId } })
    : null

  const products = await db.moySkladProduct.findMany({
    select: {
      id: true,
      name: true,
      code: true,
      article: true,
      barcodes: true,
    },
  })

  const productCandidates: ProductMatchCandidate[] = products.map((product) => ({
    id: product.id,
    name: product.name,
    code: product.code,
    article: product.article,
    barcodes: product.barcodes,
  }))

  const lastPurchaseByProduct = supplier?.moyskladCounterpartyId
    ? await loadLastPurchasePrices(db, supplier.moyskladCounterpartyId)
    : new Map<string, { price: number; moment: Date }>()

  return attachment.parsedRows.map((row) => {
    const parsedPrice = row.price ? Number(row.price) : null
    const match = matchProduct(productCandidates, { sku: row.sku, name: row.name })
    const lastPurchase = match ? lastPurchaseByProduct.get(match.product.id) : undefined

    let priceDelta: number | null = null
    let priceDeltaPercent: number | null = null
    if (parsedPrice != null && lastPurchase) {
      const delta = computePriceDelta(parsedPrice, lastPurchase.price)
      priceDelta = delta.delta
      priceDeltaPercent = delta.deltaPercent
    }

    return {
      parsedRowId: row.id,
      rowIndex: row.rowIndex,
      sku: row.sku,
      name: row.name,
      parsedPrice,
      matchedProduct: match
        ? {
            id: match.product.id,
            name: match.product.name,
            code: match.product.code,
            article: match.product.article,
          }
        : null,
      matchType: match?.matchType ?? null,
      matchConfidence: match?.confidence ?? null,
      ourLastPurchasePrice: lastPurchase?.price ?? null,
      ourLastPurchaseAt: lastPurchase?.moment.toISOString() ?? null,
      priceDelta,
      priceDeltaPercent,
      retail: null,
    }
  })
}

async function loadLastPurchasePrices(db: DbClient, counterpartyId: string) {
  const positions = await db.moySkladPurchasePosition.findMany({
    where: {
      productId: { not: null },
      purchaseOrder: { counterpartyId },
    },
    include: {
      purchaseOrder: { select: { moment: true } },
    },
    orderBy: {
      purchaseOrder: { moment: 'desc' },
    },
  })

  const map = new Map<string, { price: number; moment: Date }>()
  for (const position of positions) {
    if (!position.productId || map.has(position.productId)) continue
    map.set(position.productId, {
      price: Number(position.price),
      moment: position.purchaseOrder.moment,
    })
  }

  return map
}
