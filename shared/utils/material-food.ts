// The fields whose meaning is endorsed when a food is shared and whose origin
// matters when a diary snapshot is edited. Keeping this comparison in shared/
// gives the client confirmation and the server write exactly the same boundary.

const NUTRIENT_KEYS = ['protein', 'fat', 'carbs', 'sugar', 'fiber', 'salt'] as const

export interface MaterialFoodValues {
  name?: unknown
  phe?: unknown
  kcal?: unknown
  nutrients?: unknown
  factor?: unknown
}

export const normalizeFoodName = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toLowerCase() : ''

const comparableNumber = (value: unknown): number | null | undefined => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

const numbersEqual = (left: unknown, right: unknown): boolean => {
  const comparableLeft = comparableNumber(left)
  const comparableRight = comparableNumber(right)
  if (comparableLeft !== undefined || comparableRight !== undefined) {
    return comparableLeft === comparableRight
  }
  return left === right
}

const nutrientValue = (nutrients: unknown, key: (typeof NUTRIENT_KEYS)[number]): unknown =>
  typeof nutrients === 'object' && nutrients !== null
    ? (nutrients as Record<string, unknown>)[key]
    : null

export const nutrientsEqual = (left: unknown, right: unknown): boolean =>
  NUTRIENT_KEYS.every((key) => numbersEqual(nutrientValue(left, key), nutrientValue(right, key)))

// A factor-only correction is a material change for community votes.
export const hasMaterialFoodChange = (
  before: MaterialFoodValues,
  after: MaterialFoodValues
): boolean =>
  normalizeFoodName(before.name) !== normalizeFoodName(after.name) ||
  !numbersEqual(before.phe, after.phe) ||
  !numbersEqual(before.kcal, after.kcal) ||
  !numbersEqual(before.factor, after.factor) ||
  !nutrientsEqual(before.nutrients, after.nutrients)
