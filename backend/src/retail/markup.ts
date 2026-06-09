export type MarkupInput = {

  wholesalePrice: number | null

  retailPrices: number[]

  targetMarginPercent: number

}



export type MarkupResult = {

  medianPrice: number | null

  markupPercent: number | null

  marginPercent: number | null

  maxWholesaleAtTargetMargin: number | null

  isLowMargin: boolean

}



export function median(values: number[]) {

  if (values.length === 0) return null

  const sorted = [...values].sort((a, b) => a - b)

  const mid = Math.floor(sorted.length / 2)

  if (sorted.length % 2 === 0) {

    return (sorted[mid - 1]! + sorted[mid]!) / 2

  }

  return sorted[mid]!

}



export function computeMarkup(input: MarkupInput): MarkupResult {

  const medianPrice = median(input.retailPrices)

  const maxWholesaleAtTargetMargin =

    medianPrice == null ? null : medianPrice * (1 - input.targetMarginPercent / 100)



  let markupPercent: number | null = null

  let marginPercent: number | null = null

  if (input.wholesalePrice != null && medianPrice != null && input.wholesalePrice > 0) {

    markupPercent = ((medianPrice - input.wholesalePrice) / input.wholesalePrice) * 100

    marginPercent =

      medianPrice === 0 ? null : ((medianPrice - input.wholesalePrice) / medianPrice) * 100

  }



  const isLowMargin =

    input.wholesalePrice != null &&

    maxWholesaleAtTargetMargin != null &&

    input.wholesalePrice > maxWholesaleAtTargetMargin



  return {

    medianPrice,

    markupPercent,

    marginPercent,

    maxWholesaleAtTargetMargin,

    isLowMargin,

  }

}


