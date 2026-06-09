import type { Marketplace } from '../../generated/prisma/enums'



export type RetailSearchQuery = {

  barcode?: string | null

  article?: string | null

  name?: string | null

}



export type RetailSearchHit = {

  externalId: string

  productUrl: string

  title: string | null

}



export type RetailPriceQuote = {

  price: number

  originalPrice: number | null

  currency: string

  productUrl: string | null

  title: string | null

}



export type RetailMarketplaceAdapter = {

  marketplace: Marketplace

  searchProduct(query: RetailSearchQuery): Promise<RetailSearchHit | null>

  fetchPrice(link: { externalId: string | null; productUrl: string | null }): Promise<RetailPriceQuote | null>

}


