import { normalizeMatchToken } from './config'

export type ProductMatchCandidate = {
  id: string
  name: string
  code: string | null
  article: string | null
  barcodes: string[]
}

export type ProductMatchResult = {
  product: ProductMatchCandidate
  matchType: 'code' | 'article' | 'barcode' | 'name'
  confidence: number
} | null

export function matchProduct(
  products: ProductMatchCandidate[],
  input: { sku: string | null; name: string | null },
): ProductMatchResult {
  const sku = normalizeMatchToken(input.sku)
  const name = normalizeMatchToken(input.name)

  if (sku) {
    const byCode = products.find((product) => normalizeMatchToken(product.code) === sku)
    if (byCode) {
      return { product: byCode, matchType: 'code', confidence: 1 }
    }

    const byArticle = products.find((product) => normalizeMatchToken(product.article) === sku)
    if (byArticle) {
      return { product: byArticle, matchType: 'article', confidence: 0.95 }
    }

    const byBarcode = products.find((product) =>
      product.barcodes.some((barcode) => normalizeMatchToken(barcode) === sku),
    )
    if (byBarcode) {
      return { product: byBarcode, matchType: 'barcode', confidence: 0.95 }
    }
  }

  if (name) {
    const exactName = products.find((product) => normalizeMatchToken(product.name) === name)
    if (exactName) {
      return { product: exactName, matchType: 'name', confidence: 0.7 }
    }

    const partialName = products.find((product) => {
      const productName = normalizeMatchToken(product.name)
      return productName.includes(name) || name.includes(productName)
    })
    if (partialName) {
      return { product: partialName, matchType: 'name', confidence: 0.5 }
    }
  }

  return null
}

export function computePriceDelta(parsedPrice: number, ourPrice: number) {
  const delta = parsedPrice - ourPrice
  const deltaPercent = ourPrice === 0 ? null : (delta / ourPrice) * 100
  return { delta, deltaPercent }
}
