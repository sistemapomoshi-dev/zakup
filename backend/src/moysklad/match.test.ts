import { describe, expect, test } from 'bun:test'

import { computePriceDelta, matchProduct, type ProductMatchCandidate } from './match'

const products: ProductMatchCandidate[] = [
  {
    id: 'p1',
    name: 'Кабель USB-C 2м',
    code: 'CAB-001',
    article: 'ART-100',
    barcodes: ['4601234567890'],
  },
  {
    id: 'p2',
    name: 'Адаптер питания 65W',
    code: 'ADP-65',
    article: null,
    barcodes: [],
  },
]

describe('matchProduct', () => {
  test('matches by internal code', () => {
    expect(matchProduct(products, { sku: 'CAB-001', name: null })).toMatchObject({
      product: { id: 'p1' },
      matchType: 'code',
    })
  })

  test('matches by article when code misses', () => {
    expect(matchProduct(products, { sku: 'ART-100', name: null })).toMatchObject({
      product: { id: 'p1' },
      matchType: 'article',
    })
  })

  test('matches by barcode', () => {
    expect(matchProduct(products, { sku: '4601234567890', name: null })).toMatchObject({
      product: { id: 'p1' },
      matchType: 'barcode',
    })
  })

  test('falls back to fuzzy name match', () => {
    expect(matchProduct(products, { sku: null, name: 'адаптер питания' })).toMatchObject({
      product: { id: 'p2' },
      matchType: 'name',
    })
  })
})

describe('computePriceDelta', () => {
  test('calculates absolute and percent delta', () => {
    expect(computePriceDelta(110, 100)).toEqual({ delta: 10, deltaPercent: 10 })
  })
})
