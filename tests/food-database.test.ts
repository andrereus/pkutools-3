import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

// The USDA and BLS files are generated (see scripts/bls-convert.py) and shipped
// as static assets, so a bad regeneration is only noticed when a user logs the
// wrong Phe. These checks assert the invariants the app relies on when it maps
// a record into a diary entry.

const root = resolve(__dirname, '..')
const LOCALES = ['en', 'de', 'es', 'fr'] as const

const loadJson = <T>(relativePath: string): T =>
  JSON.parse(readFileSync(join(root, relativePath), 'utf8'))

type UsdaFood = {
  id: number
  en: string
  de: string
  es: string
  fr: string
  phe: number
  kcal: number
  emoji?: string
}

type BlsFood = {
  id: string
  name: string
  phe: number
  kcal: number
  protein: number | null
  fat: number | null
  carbs: number | null
  sugar: number | null
  fiber: number | null
  salt: number | null
  emoji?: string
}

const usda = loadJson<UsdaFood[]>('public/data/usda-phe-kcal.json')
const bls = Object.fromEntries(
  LOCALES.map((locale) => [locale, loadJson<BlsFood[]>(`public/data/bls-nutrients-${locale}.json`)])
) as Record<(typeof LOCALES)[number], BlsFood[]>

// Both sources store Phe as g/100 g and food-search multiplies by 1000 to get
// the mg the app works in. Pure protein is ~5 g Phe/100 g, so a value above 10
// means the generator emitted milligrams and every logged portion would be off
// by 1000x. (The multiplication itself lives inside food-search.vue and is not
// importable, so this guards the input to it, not the conversion.)
const MAX_PLAUSIBLE_PHE_G = 10
const MAX_PLAUSIBLE_KCAL = 1000

const OPTIONAL_NUTRIENTS = ['protein', 'fat', 'carbs', 'sugar', 'fiber', 'salt'] as const
const NUMERIC_FIELDS = ['phe', 'kcal', ...OPTIONAL_NUTRIENTS] as const

const isNonNegativeNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

type FoodRow = { id: string | number; phe: number; kcal: number; emoji?: string }

/**
 * The row-level checks both databases have to satisfy. Registered inside each
 * describe so failures still name the source, with `describeRow` supplying the
 * locale-appropriate name for the failure message.
 */
const itHasValidRows = <T extends FoodRow>(rows: T[], describeRow: (row: T) => string) => {
  it('has a unique id per food', () => {
    const ids = rows.map((food) => food.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has a finite, non-negative phe and kcal for every food', () => {
    const broken = rows.filter(
      (food) => !isNonNegativeNumber(food.phe) || !isNonNegativeNumber(food.kcal)
    )
    expect(broken.map((f) => f.id)).toEqual([])
  })

  it('keeps phe and kcal within a plausible range', () => {
    const outliers = rows.filter(
      (food) => food.phe > MAX_PLAUSIBLE_PHE_G || food.kcal > MAX_PLAUSIBLE_KCAL
    )
    expect(outliers.map((f) => `${describeRow(f)}: ${f.phe}g phe, ${f.kcal}kcal`)).toEqual([])
  })

  // The UI shows entry.emoji with no icon fallback, so a missing one renders
  // as a blank tile.
  it('has an emoji for every food', () => {
    const missing = rows.filter((food) => !food.emoji || food.emoji.trim() === '')
    expect(missing.map((f) => f.id)).toEqual([])
  })
}

describe('USDA food database', () => {
  // Load-bearing: every check below collects the bad rows and expects none, so
  // all of them would pass on a file that got truncated to an empty array.
  it('is a non-empty array', () => {
    expect(Array.isArray(usda)).toBe(true)
    expect(usda.length).toBeGreaterThan(4000)
  })

  it('has a non-empty name in every supported locale', () => {
    const broken = usda.filter((food) =>
      LOCALES.some((locale) => typeof food[locale] !== 'string' || food[locale].trim() === '')
    )
    expect(broken.map((f) => f.id)).toEqual([])
  })

  itHasValidRows(usda, (food) => `${food.id} ${food.en}`)
})

describe('BLS food database', () => {
  it('ships rows in every locale file', () => {
    for (const locale of LOCALES) {
      expect(Array.isArray(bls[locale]), locale).toBe(true)
      expect(bls[locale].length, locale).toBeGreaterThan(6000)
    }
  })

  // Food search loads one locale file at a time, so a locale that lost rows in a
  // regeneration would silently show fewer foods for those users only.
  it('has the same foods, in the same order, across all locales', () => {
    const reference = bls.en.map((food) => food.id)
    for (const locale of LOCALES) {
      expect(bls[locale].length, `${locale} row count`).toBe(reference.length)
      expect(
        bls[locale].map((food) => food.id),
        `${locale} id order`
      ).toEqual(reference)
    }
  })

  // Only the names are translated; every other field comes from one source
  // table. Food search reads nutrients straight out of the active locale's file,
  // so a value that diverges is shown to that locale's users only.
  it('has identical numbers and emoji across locales', () => {
    const mismatches: string[] = []
    bls.en.forEach((reference, index) => {
      for (const locale of LOCALES) {
        const food = bls[locale][index]!
        for (const field of [...NUMERIC_FIELDS, 'emoji'] as const) {
          if (food[field] !== reference[field]) {
            mismatches.push(
              `${reference.id} (${locale}) ${field}: ${food[field]} vs en ${reference[field]}`
            )
          }
        }
      }
    })
    expect(mismatches).toEqual([])
  })

  it.each(LOCALES)('%s has a non-empty name for every food', (locale) => {
    const broken = bls[locale].filter(
      (food) => typeof food.name !== 'string' || food.name.trim() === ''
    )
    expect(broken.map((f) => f.id)).toEqual([])
  })

  // The value checks below run on English alone. Names are the only per-locale
  // field, and the two tests above already pin every other field of every other
  // locale to the English row it sits beside.
  itHasValidRows(bls.en, (food) => `${food.id} ${food.name}`)

  // fat and fiber are genuinely absent for a handful of foods and render as a
  // dash; what must never happen is a negative or non-numeric value.
  it('has no negative or implausible optional nutrients', () => {
    const broken: string[] = []
    for (const food of bls.en) {
      for (const nutrient of OPTIONAL_NUTRIENTS) {
        const value = food[nutrient]
        if (value === null || value === undefined) continue
        // Every optional nutrient is g/100 g, so none can exceed 100.
        if (!isNonNegativeNumber(value) || value > 100) {
          broken.push(`${food.id} ${nutrient}=${value}`)
        }
      }
    }
    expect(broken).toEqual([])
  })
})
