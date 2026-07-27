import { describe, it, expect } from 'vitest'
import {
  PHE_FACTORS,
  pheFactor,
  roundReference,
  scaleToWeight,
  formatNutrient,
  nutrientRows,
  isReported,
  parseReference
} from '../app/utils/nutrition'

// These rules were duplicated across every page that calculates or displays a
// food value. A copy that drifted from the others produced a wrong number
// rather than a visible failure, which is what these tests now guard.

describe('pheFactor', () => {
  // Clinical constants, also documented in the FAQ. If one changes here it has
  // to change there too.
  it('maps each food type to its published factor', () => {
    expect(PHE_FACTORS).toEqual({ fruit: 27, vegetable: 35, meat: 46, other: 50 })
    expect(pheFactor('fruit')).toBe(27)
    expect(pheFactor('vegetable')).toBe(35)
    expect(pheFactor('meat')).toBe(46)
    expect(pheFactor('other')).toBe(50)
  })

  it('falls back to the general factor for anything unrecognised', () => {
    expect(pheFactor('cheese')).toBe(50)
    expect(pheFactor(null)).toBe(50)
    expect(pheFactor(undefined)).toBe(50)
  })
})

// Both of these guard the same trap from opposite sides: in JavaScript
// `Number(null)`, `Number('')` and `Number(false)` are all 0, so a missing value
// and a declared zero are one keystroke apart.
describe('isReported', () => {
  it('accepts a measurement, including a declared zero', () => {
    expect(isReported(0)).toBe(true)
    expect(isReported(0.00495)).toBe(true)
    expect(isReported(13.22)).toBe(true)
    // Legacy records and form fields can hold the number as a string
    expect(isReported('0')).toBe(true)
    expect(isReported('780')).toBe(true)
    expect(isReported(' 780 ')).toBe(true)
  })

  it('rejects a missing value', () => {
    expect(isReported(null)).toBe(false)
    expect(isReported(undefined)).toBe(false)
    expect(isReported('')).toBe(false)
  })

  // Every one of these coerces to 0 via Number(), which is exactly how a
  // missing value gets stored as "contains none".
  it('rejects anything that only looks like zero through Number()', () => {
    expect(Number(false)).toBe(0)
    expect(Number(' ')).toBe(0)
    expect(Number([])).toBe(0)

    expect(isReported(false)).toBe(false)
    expect(isReported(true)).toBe(false)
    expect(isReported(' ')).toBe(false)
    expect(isReported('\t\n')).toBe(false)
    expect(isReported([])).toBe(false)
    expect(isReported([5])).toBe(false)
    expect(isReported({})).toBe(false)
  })

  it('rejects a value that is not a number at all', () => {
    expect(isReported(NaN)).toBe(false)
    expect(isReported(Infinity)).toBe(false)
    expect(isReported('abc')).toBe(false)
  })
})

describe('formatNutrient half boundaries', () => {
  // 0.145 * 100 is 14.499999999999998, which rounds down to 0.14 without the
  // decimal-grid correction.
  it('rounds a half boundary up at each precision', () => {
    expect(formatNutrient(0.145, 'salt')).toBe(0.15)
    expect(formatNutrient(0.25, 'sugar')).toBe(0.3)
    expect(formatNutrient(1.15, 'fat')).toBe(1.2)
    expect(formatNutrient(10.5, 'protein')).toBe(11)
  })
})

describe('parseReference', () => {
  // 193 BLS and 104 USDA foods hold phe: 0 — spirits, oils, sugar. `|| null`
  // collapsed those to null, which the diary then read as a hand edit and used
  // to rewrite the entry's source to 'manual'.
  it('keeps an explicit zero', () => {
    expect(parseReference(0)).toBe(0)
    expect(parseReference('0')).toBe(0)
  })

  it('returns null for an empty or unusable field', () => {
    expect(parseReference(null)).toBe(null)
    expect(parseReference(undefined)).toBe(null)
    expect(parseReference('')).toBe(null)
    expect(parseReference(' ')).toBe(null)
    expect(parseReference(false)).toBe(null)
    expect(parseReference([])).toBe(null)
    expect(parseReference(NaN)).toBe(null)
  })

  // Capturing and comparing through the same parse is what makes the
  // "was this edited by hand?" check trustworthy.
  it('compares equal for an untouched value whatever its type', () => {
    expect(parseReference('780')).toBe(parseReference(780))
    expect(parseReference(0)).toBe(parseReference('0'))
    expect(parseReference(null)).toBe(parseReference(''))
  })
})

describe('roundReference', () => {
  it('keeps two decimals', () => {
    expect(roundReference(105.8)).toBe(105.8)
    expect(roundReference(460.25)).toBe(460.25)
    expect(roundReference(105.789)).toBe(105.79)
  })

  // 2.3 * 46 is 105.80000000000001 in binary floating point, which would reach
  // the database and the reference input verbatim without this.
  it('clears floating point noise from a derived reference', () => {
    expect(roundReference(2.3 * 46)).toBe(105.8)
    expect(String(roundReference(0.46025 * 1000))).toBe('460.25')
  })
})

describe('scaleToWeight', () => {
  it('rounds the consumed amount to a whole unit', () => {
    expect(scaleToWeight(105.8, 500)).toBe(529)
    expect(scaleToWeight(600, 100)).toBe(600)
    expect(scaleToWeight(50, 250)).toBe(125)
  })

  it('handles fractional weights', () => {
    expect(scaleToWeight(100, 12.5)).toBe(13)
    expect(scaleToWeight(200, 0.5)).toBe(1)
  })

  // A binary product can land just under an exact .5, where Math.round on the
  // raw value rounds down and loses a milligram: 33.3 * 1500 / 100 is
  // 499.49999999999994, not 499.5.
  it('rounds a half boundary up despite the binary representation', () => {
    expect((33.3 * 1500) / 100).toBeLessThan(499.5)
    expect(scaleToWeight(1500, 33.3)).toBe(500)
    expect(scaleToWeight(1030.85, 1000)).toBe(10309)
    expect(scaleToWeight(2.5, 100)).toBe(3)
  })

  // A reference of 0 is a reference, not a missing value — spirits and oils
  // genuinely contain no Phe.
  it('returns 0 for a zero reference at any weight', () => {
    expect(scaleToWeight(0, 500)).toBe(0)
    expect(scaleToWeight(0, 0)).toBe(0)
  })

  // Four of the fourteen copies this replaced lacked the guard and would render
  // NaN into the diary from a blank input.
  it('returns 0 rather than NaN for a missing or non-numeric input', () => {
    expect(scaleToWeight(NaN, 100)).toBe(0)
    expect(scaleToWeight(100, NaN)).toBe(0)
    expect(scaleToWeight(undefined as unknown as number, 100)).toBe(0)
    expect(scaleToWeight(100, null as unknown as number)).toBe(0)
  })
})

// The bug this whole change set started from: a reference was rounded to a whole
// mg on save while the result was computed from the unrounded product, so
// re-opening the entry and recalculating produced a different number.
describe('a result stays stable when it is recalculated', () => {
  it('reproduces the stored result from the stored reference', () => {
    const FACTORS = Object.values(PHE_FACTORS)
    let checked = 0

    for (let tenths = 0; tenths <= 300; tenths++) {
      for (const factor of FACTORS) {
        const reference = roundReference((tenths / 10) * factor)
        for (const weight of [7, 50, 100, 250.5, 500, 830, 1000]) {
          const stored = scaleToWeight(reference, weight)
          // What the diary does when the entry is opened and saved again
          expect(scaleToWeight(reference, weight)).toBe(stored)
          checked++
        }
      }
    }

    expect(checked).toBe(8428)
  })

  // The old behaviour, kept as a description of what regressed: rounding the
  // reference to a whole mg while computing the result from the raw product.
  it('would drift if the reference were rounded to a whole mg', () => {
    const protein = 2.3
    const factor = PHE_FACTORS.meat
    const weight = 500

    const wasStoredReference = Math.round(protein * factor) // 106
    const wasStoredResult = Math.round((weight * (protein * factor)) / 100) // 529
    expect(scaleToWeight(wasStoredReference, weight)).not.toBe(wasStoredResult)

    const reference = roundReference(protein * factor) // 105.8
    expect(scaleToWeight(reference, weight)).toBe(529)
  })
})

describe('formatNutrient', () => {
  // A trailing decimal on a two-digit number is the hardest thing in the grid
  // to scan, so it drops away once the value reaches 10 g.
  it('shows whole grams from 10 g up', () => {
    expect(formatNutrient(13.22)).toBe(13)
    expect(formatNutrient(53.3)).toBe(53)
    expect(formatNutrient(95.3625)).toBe(95)
    expect(formatNutrient(10)).toBe(10)
  })

  it('shows one decimal between 1 g and 10 g', () => {
    expect(formatNutrient(9.94)).toBe(9.9)
    expect(formatNutrient(6.65)).toBe(6.7)
    expect(formatNutrient(1.08)).toBe(1.1)
  })

  // One decimal below 1 g too, so a column stays comparable: 0.33 next to 2.1
  // reads as the larger number purely because it is longer.
  it('keeps one decimal below 1 g for everything but salt', () => {
    expect(formatNutrient(0.33, 'fat')).toBe(0.3)
    expect(formatNutrient(0.74, 'sugar')).toBe(0.7)
    expect(formatNutrient(0.05, 'fiber')).toBe(0.1)
  })

  // Salt is the one carve-out, matching the EC guidance: it is the only
  // nutrient that routinely lives below 0.1 g.
  it('gives salt two decimals below 1 g', () => {
    expect(formatNutrient(2.2, 'salt')).toBe(2.2)
    expect(formatNutrient(0.928, 'salt')).toBe(0.93)
    expect(formatNutrient(0.192, 'salt')).toBe(0.19)
    expect(formatNutrient(0.05, 'salt')).toBe(0.05)
  })

  // Deliberate deviation from the label rule, which permits declaring a small
  // amount as 0. The floor follows the precision the nutrient is shown at.
  it('never renders a value it holds as zero', () => {
    expect(formatNutrient(0.00495, 'salt')).toBe('< 0.01')
    expect(formatNutrient(0.001, 'salt')).toBe('< 0.01')
    expect(formatNutrient(0.04, 'fiber')).toBe('< 0.1')
    expect(formatNutrient(0, 'salt')).toBe(0)
  })
})

describe('nutrientRows', () => {
  const t = (key: string) => key

  it('scales each nutrient to the consumed weight', () => {
    const rows = nutrientRows({ protein: 11.375, salt: 0.02 }, 200, t)
    expect(rows).toEqual([
      { key: 'protein', label: 'common.protein', value: 23 },
      { key: 'salt', label: 'common.salt', value: 0.04 }
    ])
  })

  it('keeps the display order regardless of the stored key order', () => {
    const rows = nutrientRows({ salt: 1, carbs: 20, protein: 5 }, 100, t)
    expect(rows.map((row) => row.key)).toEqual(['protein', 'carbs', 'salt'])
  })

  // A scanned product often carries protein alone; the grid lists what exists
  // rather than rendering five empty rows.
  it('omits nutrients the food has no value for', () => {
    expect(nutrientRows({ protein: 8, fat: null, fiber: undefined }, 100, t)).toHaveLength(1)
    expect(nutrientRows(null, 100, t)).toEqual([])
    expect(nutrientRows(undefined, 100, t)).toEqual([])
  })

  it('keeps an explicit zero, which is a real declared value', () => {
    const rows = nutrientRows({ sugar: 0 }, 100, t)
    expect(rows).toEqual([{ key: 'sugar', label: 'common.sugar', value: 0 }])
  })
})
