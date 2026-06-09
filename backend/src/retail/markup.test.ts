import { describe, expect, test } from 'bun:test'



import { computeMarkup, median } from './markup'



describe('median', () => {

  test('returns null for empty input', () => {

    expect(median([])).toBeNull()

  })



  test('returns middle value for odd count', () => {

    expect(median([450, 500, 400])).toBe(450)

  })



  test('returns average of two middle values for even count', () => {

    expect(median([400, 500])).toBe(450)

  })

})



describe('computeMarkup', () => {

  test('calculates markup, margin and max wholesale at target margin', () => {

    const result = computeMarkup({

      wholesalePrice: 340,

      retailPrices: [450, 460],

      targetMarginPercent: 30,

    })



    expect(result.medianPrice).toBe(455)

    expect(result.markupPercent).toBeCloseTo(33.82, 1)

    expect(result.marginPercent).toBeCloseTo(25.27, 1)

    expect(result.maxWholesaleAtTargetMargin).toBeCloseTo(318.5, 1)

    expect(result.isLowMargin).toBe(true)

  })



  test('marks acceptable wholesale as not low margin', () => {

    const result = computeMarkup({

      wholesalePrice: 310,

      retailPrices: [450],

      targetMarginPercent: 30,

    })



    expect(result.maxWholesaleAtTargetMargin).toBe(315)

    expect(result.isLowMargin).toBe(false)

  })

})

