import { extractJsonLdPrices, fetchText, pickLowestPositive } from '../http'

import type { RetailMarketplaceAdapter, RetailPriceQuote, RetailSearchHit, RetailSearchQuery } from './types'



export function createYandexMarketAdapter(timeoutMs: number): RetailMarketplaceAdapter {

  return {

    marketplace: 'yandex_market',



    async searchProduct(query: RetailSearchQuery): Promise<RetailSearchHit | null> {

      const searchTerm = query.barcode ?? query.article ?? query.name ?? null

      if (!searchTerm) return null



      const url = `https://market.yandex.ru/search?text=${encodeURIComponent(searchTerm)}`

      const html = await fetchText(url, timeoutMs)

      const productUrl = extractFirstMarketUrl(html)

      if (!productUrl) return null



      return {

        externalId: productUrl,

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

        title: extractTitle(html),

      }

    },

  }

}



function extractFirstMarketUrl(html: string) {

  const match = html.match(/href="(https:\/\/market\.yandex\.ru\/product[^"?]+)/i)

  return match?.[1] ?? null

}



function extractTitle(html: string) {

  const match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)

  return match?.[1]?.trim() ?? null

}


