import { comparableFoodNumber, NUTRIENT_KEYS, type MaterialFoodValues } from './material-food'

export const FOOD_CONTENT_FIELDS = [
  'name',
  'phe',
  'kcal',
  'factor',
  ...NUTRIENT_KEYS,
  'note'
] as const
export type FoodContentField = (typeof FOOD_CONTENT_FIELDS)[number]

export interface FoodContentValues extends MaterialFoodValues {
  note?: unknown
}

const contentValue = (food: FoodContentValues, field: FoodContentField): string | number | null => {
  if (field === 'name' || field === 'note') {
    const value = food[field]
    return typeof value === 'string' ? value.trim() || null : null
  }
  const value =
    field === 'phe' || field === 'kcal' || field === 'factor'
      ? food[field]
      : typeof food.nutrients === 'object' && food.nutrients !== null
        ? (food.nutrients as Record<string, unknown>)[field]
        : null
  return comparableFoodNumber(value) ?? null
}

/** Compare values only in memory; history stores field names, never old/new content. */
export const changedFoodContentFields = (
  before: FoodContentValues,
  after: FoodContentValues
): FoodContentField[] =>
  FOOD_CONTENT_FIELDS.filter((field) => contentValue(before, field) !== contentValue(after, field))
