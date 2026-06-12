import type { DbClient } from '../db'
import { extractIdFromHref, minorUnitsToMajor } from './config'
import type { MoySkladClient } from './client'
import type { MoySkladCounterpartyEntity, MoySkladFileMeta, MoySkladPurchaseOrderEntity } from './types'

export async function syncCounterparties(db: DbClient, client: MoySkladClient) {
  const rows = await client.fetchAllRows<MoySkladCounterpartyEntity>('/entity/counterparty', {
    filter: 'archived=false',
  })

  let synced = 0
  for (const row of rows) {
    await db.moySkladCounterparty.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        name: row.name,
        email: row.email ?? null,
        phone: row.phone ?? null,
      },
      update: {
        name: row.name,
        email: row.email ?? null,
        phone: row.phone ?? null,
        syncedAt: new Date(),
      },
    })
    synced += 1
  }

  return synced
}

export async function syncProducts(db: DbClient, client: MoySkladClient) {
  const rows = await client.fetchAllRows<{
    id: string
    name: string
    code?: string
    article?: string
    barcodes?: Array<{ ean13?: string; gtin?: string }>
    buyPrice?: { value: number }
    salePrices?: Array<{ value: number; priceType?: { meta?: { href: string } } }>
    updated?: string
  }>('/entity/product', {
    filter: 'archived=false',
  })

  let synced = 0
  for (const row of rows) {
    const barcodes = (row.barcodes ?? [])
      .flatMap((entry) => [entry.ean13, entry.gtin].filter(Boolean))
      .map(String)

    await db.moySkladProduct.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        name: row.name,
        code: row.code ?? null,
        article: row.article ?? null,
        barcodes,
        buyPrice: row.buyPrice ? minorUnitsToMajor(row.buyPrice.value) : null,
        salePrices: row.salePrices ?? undefined,
        msUpdatedAt: row.updated ? new Date(row.updated) : null,
      },
      update: {
        name: row.name,
        code: row.code ?? null,
        article: row.article ?? null,
        barcodes,
        buyPrice: row.buyPrice ? minorUnitsToMajor(row.buyPrice.value) : null,
        salePrices: row.salePrices ?? undefined,
        msUpdatedAt: row.updated ? new Date(row.updated) : null,
        syncedAt: new Date(),
      },
    })
    synced += 1
  }

  return synced
}

export async function syncPurchaseOrders(db: DbClient, client: MoySkladClient) {
  const rows = await client.fetchAllRows<MoySkladPurchaseOrderEntity>('/entity/purchaseorder', {
    expand: 'agent,positions',
    order: 'moment,desc',
  })

  let ordersSynced = 0
  let positionsSynced = 0
  let filesSynced = 0

  for (const row of rows) {
    const counterpartyId = row.agent?.meta?.href ? extractIdFromHref(row.agent.meta.href) : null
    if (!counterpartyId) continue

    await db.moySkladCounterparty.upsert({
      where: { id: counterpartyId },
      create: {
        id: counterpartyId,
        name: row.agent?.name ?? counterpartyId,
      },
      update: {
        name: row.agent?.name ?? counterpartyId,
        syncedAt: new Date(),
      },
    })

    await db.moySkladPurchaseOrder.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        counterpartyId,
        name: row.name,
        moment: new Date(row.moment),
      },
      update: {
        counterpartyId,
        name: row.name,
        moment: new Date(row.moment),
        syncedAt: new Date(),
      },
    })
    ordersSynced += 1
    filesSynced += await syncEntityFiles(db, 'purchaseorder', row.id, row.files ?? [])

    await db.moySkladPurchasePosition.deleteMany({ where: { purchaseOrderId: row.id } })

    const positions = row.positions?.rows ?? []
    if (positions.length === 0) continue

    await db.moySkladPurchasePosition.createMany({
      data: positions.map((position) => {
        const productId =
          position.assortment?.id ??
          (position.assortment?.meta?.href
            ? extractIdFromHref(position.assortment.meta.href)
            : null)

        return {
          purchaseOrderId: row.id,
          productId,
          productName: position.assortment?.name ?? null,
          quantity: position.quantity,
          price: minorUnitsToMajor(position.price),
        }
      }),
    })
    positionsSynced += positions.length
  }

  return { ordersSynced, positionsSynced, filesSynced }
}

export function normalizeMoySkladFiles(files: MoySkladFileMeta[]) {
  return files
    .map((file) => {
      const href = file.meta?.href?.trim()
      if (!href) return null
      const size = file.size

      return {
        href,
        filename: file.filename?.trim() || file.title?.trim() || href.split('/').pop() || 'file',
        sizeBytes: size !== undefined && Number.isInteger(size) && size >= 0 ? size : null,
      }
    })
    .filter((file): file is { href: string; filename: string; sizeBytes: number | null } => file !== null)
}

async function syncEntityFiles(
  db: DbClient,
  entityType: string,
  entityId: string,
  files: MoySkladFileMeta[],
) {
  const normalizedFiles = normalizeMoySkladFiles(files)
  const hrefs = normalizedFiles.map((file) => file.href)

  await db.moySkladFile.deleteMany({
    where: {
      entityType,
      entityId,
      ...(hrefs.length > 0 ? { href: { notIn: hrefs } } : {}),
    },
  })

  for (const file of normalizedFiles) {
    await db.moySkladFile.upsert({
      where: { href: file.href },
      create: {
        entityType,
        entityId,
        href: file.href,
        filename: file.filename,
        sizeBytes: file.sizeBytes,
      },
      update: {
        entityType,
        entityId,
        filename: file.filename,
        sizeBytes: file.sizeBytes,
        syncedAt: new Date(),
      },
    })
  }

  return normalizedFiles.length
}

export async function linkSuppliersToCounterparties(db: DbClient) {
  const suppliers = await db.supplier.findMany({
    where: { moyskladCounterpartyId: { not: null } },
    select: { id: true, moyskladCounterpartyId: true },
  })

  let linked = 0
  for (const supplier of suppliers) {
    if (!supplier.moyskladCounterpartyId) continue
    const exists = await db.moySkladCounterparty.findUnique({
      where: { id: supplier.moyskladCounterpartyId },
    })
    if (exists) linked += 1
  }

  return linked
}
