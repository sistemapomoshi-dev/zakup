import { extractJsonLdPrices, fetchText, pickLowestPositive } from '../http'

import type { RetailMarketplaceAdapter, RetailPriceQuote, RetailSearchHit, RetailSearchQuery } from './types'



export function createOzonAdapter(timeoutMs: number): RetailMarketplaceAdapter {

  return {

    marketplace: 'ozon',



    async searchProduct(query: RetailSearchQuery): Promise<RetailSearchHit | null> {

      const searchTerm = query.barcode ?? query.article ?? null

      if (!searchTerm) return null



      const url = `https://www.ozon.ru/search/?text=${encodeURIComponent(searchTerm)}`

      const html = await fetchText(url, timeoutMs)

      const productUrl = extractFirstOzonProductUrl(html)

      if (!productUrl) return null



      return {

        externalId: extractOzonSku(productUrl),

        productUrl,

        title: null,

      }

    },



    async fetchPrice(link): Promise<RetailPriceQuote | null> {

      if (!link.productUrl) return null



      const html = await fetchText(link.productUrl, timeoutMs)

      const price = pickLowestPositive(extractJsonLdPrices(html))

      if (price == null) return null



      return {

        price,

        originalPrice: null,

        currency: 'RUB',

        productUrl: link.productUrl,

        title: extractOzonTitle(html),

      }

    },

  }

}



function extractFirstOzonProductUrl(html: string) {

  const match = html.match(/href="(\/product\/[^"?]+)/i)

  if (!match?.[1]) return null

  return `https://www.ozon.ru${match[1]}`

}



function extractOzonSku(productUrl: string) {

  const match = productUrl.match(/-(\d+)\/?$/)

  return match?.[1] ?? productUrl

}



function extractOzonTitle(html: string) {

  const match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)

  return match?.[1]?.trim() ?? null

}


