export type MoySkladMeta = {
  href: string
  type: string
  mediaType: string
}

export type MoySkladListResponse<T> = {
  context?: MoySkladMeta
  meta: { href: string; type: string; mediaType: string; size: number; limit: number; offset: number }
  rows: T[]
}

export type MoySkladCounterpartyEntity = {
  id: string
  name: string
  email?: string
  phone?: string
  archived?: boolean
  updated?: string
}

export type MoySkladProductEntity = {
  id: string
  name: string
  code?: string
  article?: string
  barcodes?: Array<{ ean13?: string; gtin?: string }>
  buyPrice?: { value: number; currency?: { name?: string } }
  salePrices?: Array<{ value: number; priceType?: { meta?: MoySkladMeta } }>
  updated?: string
}

export type MoySkladPurchaseOrderEntity = {
  id: string
  name: string
  moment: string
  agent?: { meta: MoySkladMeta; name?: string }
  positions?: MoySkladListResponse<MoySkladPurchasePositionEntity>
}

export type MoySkladPurchasePositionEntity = {
  id?: string
  quantity: number
  price: number
  assortment?: {
    meta?: MoySkladMeta
    id?: string
    name?: string
    code?: string
    article?: string
  }
}

export type MoySkladTokenResponse = {
  access_token: string
  expires_in: number
}

export type MoySkladSyncResult = {
  counterparties: number
  products: number
  purchaseOrders: number
  purchasePositions: number
  linkedSuppliers: number
}
