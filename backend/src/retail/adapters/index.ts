import { createOzonAdapter } from './ozon'

import type { RetailMarketplaceAdapter } from './types'

import { createWildberriesAdapter } from './wildberries'

import { createYandexMarketAdapter } from './yandex-market'



export function createRetailAdapters(timeoutMs: number): RetailMarketplaceAdapter[] {

  return [

    createWildberriesAdapter(timeoutMs),

    createOzonAdapter(timeoutMs),

    createYandexMarketAdapter(timeoutMs),

  ]

}



export type { RetailMarketplaceAdapter, RetailPriceQuote, RetailSearchHit, RetailSearchQuery } from './types'


