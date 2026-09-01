// Shared nutrition rules for calculators and food editors. Keeping them here
// ensures stored and displayed values use the same calculations.

// Phe conversion factors in mg Phe per gram of protein, by food type. The FAQ
// documents these same numbers.
export const PHE_FACTORS = {
  fruit: 27,
  vegetable: 35,
  meat: 46,
  other: 50
} as const

export type FoodType = keyof typeof PHE_FACTORS

// The factor for a food type, falling back to the general one. Callers that
// have a mode where no conversion applies (the Phe calculator's direct-Phe
// mode) decide that before asking.
export const pheFactor = (foodType: string | null | undefined): number =>
  PHE_FACTORS[foodType as FoodType] ?? PHE_FACTORS.other

// Returns null for factors outside the four supported food types.
export const foodTypeForFactor = (factor: unknown): FoodType | null => {
  const stored = Number(factor)
  return (
    (Object.keys(PHE_FACTORS) as FoodType[]).find((type) => PHE_FACTORS[type] === stored) ?? null
  )
}

// Shared protein-to-Phe conversion for calculators and editors.
export const proteinPheReference = (
  protein: unknown,
  foodType: string | null | undefined
): number => {
  const derived = Number(protein) * pheFactor(foodType)
  return Number.isFinite(derived) ? roundReference(derived) : 0
}

// True when a source actually reported a value. Coercion is the trap here:
// `Number(null)`, `Number('')`, `Number(' ')`, `Number(false)` and `Number([])`
// are all 0, so anything that leans on Number() turns "nobody measured this"
// into "this food contains none of it". Only a finite number, or a string that
// holds one, counts as reported — a boolean or an array is malformed input from
// Open Food Facts, not a measurement of zero.
export const isReported = (value: unknown): boolean => {
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'string') return value.trim() !== '' && Number.isFinite(Number(value))
  return false
}

// Stored records may contain legacy numeric strings. Use this when adding
// values so `100 + "50"` cannot turn a displayed total into the string
// "10050"; malformed values contribute nothing.
export const numericOrZero = (value: unknown): number => (isReported(value) ? Number(value) : 0)

// Read a per-100 g reference out of an editable field. An empty field means "no
// reference", but an explicit 0 is a real value — spirits and oils have no Phe
// at all, and the food databases store them that way. `|| null` would collapse
// that 0 to null, which the diary would then read as a hand edit and use to
// rewrite the entry's provenance.
export const parseReference = (value: unknown): number | null =>
  isReported(value) ? Number(value) : null

interface DiaryProvenance {
  factor?: unknown
  source?: string | null
  sourceId?: string | null
  addedFrom?: string | null
  materiallyEdited?: boolean
}

// Checks whether stored Phe matches its recorded protein conversion.
export const pheContradictsConversion = (
  phe: unknown,
  protein: unknown,
  factor: unknown
): boolean => {
  const foodType = foodTypeForFactor(factor)
  if (foodType === null || !isReported(phe) || !isReported(protein)) return false

  const stored = Number(phe)
  const calculated = proteinPheReference(protein, foodType)

  // Older records kept derived references as whole mg. Both precisions describe
  // the same conversion and should not prompt a corrective edit.
  return stored !== calculated && stored !== Math.round(calculated)
}

// Preserve source fields, update the factor, and keep the edit flag monotonic.
export const diaryProvenanceAfterEdit = (item: DiaryProvenance, materialChange: boolean) => ({
  factor: Number(item.factor) || null,
  source: item.source || null,
  sourceId: item.sourceId || null,
  addedFrom: item.addedFrom || null,
  ...((item.materiallyEdited === true || materialChange) && { materiallyEdited: true })
})

// Round half up, on the decimal value rather than on its binary approximation.
// 33.3 × 1500 / 100 is 499.49999999999994 in binary, so a plain Math.round
// sends it to 499 where the exact result is 499.5 → 500. Trimming to 12
// significant digits first lands the value back on the decimal grid; that is
// far more precision than any nutrition figure carries, so it only ever removes
// representation noise.
const roundHalfUp = (value: number, decimals = 0): number => {
  const factor = 10 ** decimals
  return Math.round(Number((value * factor).toPrecision(12))) / factor
}

// Per-100 g references the app computes itself — protein × factor, or g → mg —
// are kept at two decimals. Values copied from a food database or typed by the
// user are stored exactly as published or entered and must not pass through
// here: BLS stores salt as 0.00495 g, which two decimals would turn into zero.
export const roundReference = (value: number): number => roundHalfUp(value, 2)

// A consumed amount, from a per-100 g reference and the eaten weight. Every
// result the app stores or shows goes through this. Computing it from the
// stored reference — rather than from whatever longer expression produced that
// reference — is what keeps the number stable when an entry is re-opened and
// recalculated. `|| 0` covers a blank or non-numeric input, which would
// otherwise surface as NaN.
export const scaleToWeight = (reference: number, weight: number): number =>
  roundHalfUp((weight * reference) / 100) || 0

// Display rounding for a nutrient amount in grams, so a row of values stays
// visually comparable:
//
//   >= 10 g   whole grams   a trailing decimal on a two-digit number is harder
//                           to scan, and it is what tracking apps and package
//                           declarations both do
//   < 10 g    one decimal
//   < 1 g     one decimal, except salt, which gets two
//   > 0       "< 0.1", or "< 0.01" for salt — never print a value we hold as 0
//
// Salt is carved out because it is the only nutrient that routinely sits below
// 0.1 g, and the EC guidance on tolerances makes the same exception. Two
// decimals for everything instead would leave 0.33 next to 2.1 in one column,
// where the longer number reads as the larger one.
//
// The floor departs from that guidance deliberately: it declares small amounts
// as "0 g", which is fine on a packet and wrong in a tracker.
export const formatNutrient = (grams: number, nutrient?: string): number | string => {
  if (grams >= 10) return roundHalfUp(grams)
  if (grams >= 1) return roundHalfUp(grams, 1)
  const decimals = nutrient === 'salt' ? 2 : 1
  const rounded = roundHalfUp(grams, decimals)
  return rounded === 0 && grams > 0 ? `< ${1 / 10 ** decimals}` : rounded
}

// The common nutrients, in display order, with the i18n key for each label.
export const NUTRIENT_LABEL_KEYS = {
  protein: 'common.protein',
  fat: 'common.fat',
  carbs: 'common.carbs',
  sugar: 'common.sugar',
  fiber: 'common.fiber',
  salt: 'common.salt'
} as const

export interface NutrientRow {
  key: string
  label: string
  value: number | string
}

// Rows for the nutrient grid: every nutrient the food actually carries, scaled
// from per 100 g to the consumed weight. What the food has no value for is left
// out, so a scanned product with protein alone doesn't render five empty rows.
export const nutrientRows = (
  nutrients: Record<string, number | null | undefined> | null | undefined,
  weight: number,
  t: (key: string) => string
): NutrientRow[] => {
  if (!nutrients) return []
  return Object.entries(NUTRIENT_LABEL_KEYS)
    .filter(([key]) => nutrients[key] != null)
    .map(([key, labelKey]) => ({
      key,
      label: t(labelKey),
      value: formatNutrient((Number(nutrients[key]) * weight) / 100, key)
    }))
}
