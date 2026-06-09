import { fetchJson, pickLowestPositive } from '../http'

import type { RetailMarketplaceAdapter, RetailPriceQuote, RetailSearchHit, RetailSearchQuery } from './types'



type WbSearchResponse = {

  data?: {

    products?: Array<{

      id?: number

      name?: string

      salePriceU?: number

      priceU?: number

    }>

  }

}



type WbCardResponse = {

  data?: {

    products?: Array<{

      id?: number

      name?: string

      salePriceU?: number

      priceU?: number

    }>

  }

}



export function createWildberriesAdapter(timeoutMs: number): RetailMarketplaceAdapter {

  return {

    marketplace: 'wildberries',



    async searchProduct(query: RetailSearchQuery): Promise<RetailSearchHit | null> {

      const searchTerm = query.barcode ?? query.article ?? null

      if (!searchTerm) return null



      const url = new URL('https://search.wb.ru/exactmatch/ru/common/v5/search')

      url.searchParams.set('appType', '1')

      url.searchParams.set('curr', 'rub')

      url.searchParams.set('dest', '-1257786')

      url.searchParams.set('query', searchTerm)

      url.searchParams.set('resultset', 'catalog')



      const payload = await fetchJson<WbSearchResponse>(url.toString(), timeoutMs)

      const product = payload.data?.products?.[0]

      if (!product?.id) return null



      return {

        externalId: String(product.id),

        productUrl: `https://www.wildberries.ru/catalog/${product.id}/detail.aspx`,

        title: product.name ?? null,

      }

    },



    async fetchPrice(link): Promise<RetailPriceQuote | null> {

      const nm = link.externalId ?? extractNmFromUrl(link.productUrl)

      if (!nm) return null



      const url = new URL('https://card.wb.ru/cards/v2/detail')

      url.searchParams.set('appType', '1')

      url.searchParams.set('curr', 'rub')

      url.searchParams.set('dest', '-1257786')

      url.searchParams.set('nm', nm)



      const payload = await fetchJson<WbCardResponse>(url.toString(), timeoutMs)

      const product = payload.data?.products?.[0]

      if (!product) return null



      const sale = product.salePriceU ? product.salePriceU / 100 : null

      const regular = product.priceU ? product.priceU / 100 : null

      const price = pickLowestPositive([sale, regular].filter((value): value is number => value != null))

      if (price == null) return null



      return {

        price,

        originalPrice: regular != null && sale != null && regular > sale ? regular : null,

        currency: 'RUB',

        productUrl: `https://www.wildberries.ru/catalog/${nm}/detail.aspx`,

        title: product.name ?? null,

      }

    },

  }

}



function extractNmFromUrl(productUrl: string | null) {

  if (!productUrl) return null

  const match = productUrl.match(/\/catalog\/(\d+)\//i)

  return match?.[1] ?? null

}


