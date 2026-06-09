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
    const [counterparties, products, purchaseOrders] = await Promise.all([
      this.db.moySkladCounterparty.count(),
      this.db.moySkladProduct.count(),
      this.db.moySkladPurchaseOrder.count(),
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
