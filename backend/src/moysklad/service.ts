import type { DbClient } from '../db'
import type { AppEnv } from '../env'
import { AppError } from '../http/errors'
import { enrichComparisonWithRetail } from '../retail/enrich-comparison'
import { MoySkladClient } from './client'
import { moyskladConfigFromEnv } from './config'
import { compareAttachmentPrices } from './compare'
import { linkSuppliersToCounterparties, syncCounterparties, syncProducts, syncPurchaseOrders } from './sync'
import type { MoySkladSyncResult } from './types'

export class MoySkladService {
  constructor(
    private readonly db: DbClient,
    private readonly env: AppEnv,
  ) {}

  isConfigured() {
    return moyskladConfigFromEnv(this.env) !== null
  }

  async getStatus() {
    const state = await this.db.moySkladSyncState.findUnique({ where: { id: 'default' } })
    const [counterparties, products, purchaseOrders, files] = await Promise.all([
      this.db.moySkladCounterparty.count(),
      this.db.moySkladProduct.count(),
      this.db.moySkladPurchaseOrder.count(),
      this.db.moySkladFile.count(),
    ])

    return {
      configured: this.isConfigured(),
      lastFullSyncAt: state?.lastFullSyncAt?.toISOString() ?? null,
      lastCounterpartiesSyncAt: state?.lastCounterpartiesSyncAt?.toISOString() ?? null,
      lastProductsSyncAt: state?.lastProductsSyncAt?.toISOString() ?? null,
      lastPurchaseOrdersSyncAt: state?.lastPurchaseOrdersSyncAt?.toISOString() ?? null,
      lastError: state?.lastError ?? null,
      counts: {
        counterparties,
        products,
        purchaseOrders,
        files,
      },
    }
  }

  async syncAll(): Promise<MoySkladSyncResult> {
    const config = moyskladConfigFromEnv(this.env)
    if (!config) {
      throw new AppError(503, 'INTERNAL_ERROR', 'MoySklad is not configured')
    }

    const client = new MoySkladClient(config)

    try {
      const counterparties = await syncCounterparties(this.db, client)
      await this.touchSyncState({ lastCounterpartiesSyncAt: new Date() })

      const products = await syncProducts(this.db, client)
      await this.touchSyncState({ lastProductsSyncAt: new Date() })

      const purchase = await syncPurchaseOrders(this.db, client)
      await this.touchSyncState({ lastPurchaseOrdersSyncAt: new Date() })

      const linkedSuppliers = await linkSuppliersToCounterparties(this.db)
      const now = new Date()

      await this.touchSyncState({
        lastFullSyncAt: now,
        lastError: null,
      })

      return {
        counterparties,
        products,
        purchaseOrders: purchase.ordersSynced,
        purchasePositions: purchase.positionsSynced,
        files: purchase.filesSynced,
        linkedSuppliers,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'MoySklad sync failed'
      await this.touchSyncState({ lastError: message })
      throw new AppError(502, 'INTERNAL_ERROR', message)
    }
  }

  async compareAttachment(attachmentId: string, supplierId: string | null) {
    const rows = await compareAttachmentPrices(this.db, attachmentId, supplierId)
    return enrichComparisonWithRetail(this.db, this.env, rows)
  }

  async listPriceSuggestions(filters: {
    status?: 'suggested' | 'confirmed' | 'rejected'
    supplierId?: string
  }) {
    const suggestions = await this.db.moySkladPriceSuggestion.findMany({
      where: {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.supplierId ? { supplierId: filters.supplierId } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        product: { select: { name: true } },
        parsedRow: { select: { sku: true, name: true } },
      },
    })
    return suggestions.map(toPriceSuggestionDto)
  }

  async createPriceSuggestionsFromAttachment(attachmentId: string, supplierId: string | null) {
    const attachment = await this.db.emailAttachment.findUnique({
      where: { id: attachmentId },
      select: {
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
    const comparisonRows = await compareAttachmentPrices(this.db, attachmentId, effectiveSupplierId)
    const suggestions = []

    for (const row of comparisonRows) {
      if (!row.matchedProduct || row.parsedPrice == null) continue

      const existing = await this.db.moySkladPriceSuggestion.findUnique({
        where: {
          parsedRowId_productId: {
            parsedRowId: row.parsedRowId,
            productId: row.matchedProduct.id,
          },
        },
        include: {
          product: { select: { name: true } },
          parsedRow: { select: { sku: true, name: true } },
        },
      })

      if (existing?.status === 'confirmed') {
        suggestions.push(toPriceSuggestionDto(existing))
        continue
      }

      const suggestion = existing
        ? await this.db.moySkladPriceSuggestion.update({
            where: { id: existing.id },
            data: {
              supplierId: effectiveSupplierId,
              suggestedPrice: row.parsedPrice,
              currentPrice: row.ourLastPurchasePrice,
              priceDelta: row.priceDelta,
              currency: 'RUB',
              status: 'suggested',
              confirmedById: null,
              confirmedAt: null,
              rejectedAt: null,
              rejectionReason: null,
            },
            include: {
              product: { select: { name: true } },
              parsedRow: { select: { sku: true, name: true } },
            },
          })
        : await this.db.moySkladPriceSuggestion.create({
            data: {
              parsedRowId: row.parsedRowId,
              supplierId: effectiveSupplierId,
              productId: row.matchedProduct.id,
              suggestedPrice: row.parsedPrice,
              currentPrice: row.ourLastPurchasePrice,
              priceDelta: row.priceDelta,
              currency: 'RUB',
            },
            include: {
              product: { select: { name: true } },
              parsedRow: { select: { sku: true, name: true } },
            },
          })

      suggestions.push(toPriceSuggestionDto(suggestion))
    }

    return suggestions
  }

  async confirmPriceSuggestion(actorId: string, suggestionId: string) {
    const suggestion = await this.db.moySkladPriceSuggestion.findUnique({
      where: { id: suggestionId },
      include: {
        product: { select: { name: true } },
        parsedRow: { select: { sku: true, name: true } },
      },
    })
    if (!suggestion) {
      throw new AppError(404, 'NOT_FOUND', 'Price suggestion not found')
    }
    if (suggestion.status === 'confirmed') {
      return toPriceSuggestionDto(suggestion)
    }

    const updated = await this.db.moySkladPriceSuggestion.update({
      where: { id: suggestionId },
      data: {
        status: 'confirmed',
        confirmedById: actorId,
        confirmedAt: new Date(),
        rejectedAt: null,
        rejectionReason: null,
      },
      include: {
        product: { select: { name: true } },
        parsedRow: { select: { sku: true, name: true } },
      },
    })
    return toPriceSuggestionDto(updated)
  }

  private async touchSyncState(data: {
    lastFullSyncAt?: Date
    lastCounterpartiesSyncAt?: Date
    lastProductsSyncAt?: Date
    lastPurchaseOrdersSyncAt?: Date
    lastError?: string | null
  }) {
    await this.db.moySkladSyncState.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...data },
      update: data,
    })
  }
}

function toPriceSuggestionDto(suggestion: {
  id: string
  parsedRowId: string
  supplierId: string | null
  productId: string
  suggestedPrice: unknown
  currentPrice: unknown
  priceDelta: unknown
  currency: string
  status: 'suggested' | 'confirmed' | 'rejected'
  confirmedById: string | null
  confirmedAt: Date | null
  rejectedAt: Date | null
  rejectionReason: string | null
  createdAt: Date
  updatedAt: Date
  product: { name: string }
  parsedRow: { sku: string | null; name: string | null }
}) {
  return {
    id: suggestion.id,
    parsedRowId: suggestion.parsedRowId,
    supplierId: suggestion.supplierId,
    productId: suggestion.productId,
    productName: suggestion.product.name,
    sku: suggestion.parsedRow.sku,
    name: suggestion.parsedRow.name,
    suggestedPrice: Number(suggestion.suggestedPrice),
    currentPrice: suggestion.currentPrice != null ? Number(suggestion.currentPrice) : null,
    priceDelta: suggestion.priceDelta != null ? Number(suggestion.priceDelta) : null,
    currency: suggestion.currency,
    status: suggestion.status,
    confirmedById: suggestion.confirmedById,
    confirmedAt: suggestion.confirmedAt?.toISOString() ?? null,
    rejectedAt: suggestion.rejectedAt?.toISOString() ?? null,
    rejectionReason: suggestion.rejectionReason,
    createdAt: suggestion.createdAt.toISOString(),
    updatedAt: suggestion.updatedAt.toISOString(),
  }
}
