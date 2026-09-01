import { hasMaterialFoodChange } from '../../shared/utils/material-food'

type FoodRecord = Record<string, unknown>

// Source and collection fields are immutable; the conversion factor is editable.
const IMMUTABLE_DIARY_FIELDS = [
  'itemId',
  'createdAt',
  'source',
  'sourceId',
  'addedFrom',
  'communityFoodKey'
] as const
const IMMUTABLE_DIARY_FIELD_SET = new Set<string>(IMMUTABLE_DIARY_FIELDS)
const RETAINED_WHEN_OMITTED = ['nutrients', 'factor'] as const

const diaryMaterialValues = (item: FoodRecord) => ({
  name: item.name,
  phe: item.pheReference,
  kcal: item.kcalReference,
  nutrients: item.nutrients,
  factor: item.factor
})

// Preserve provenance and derive the monotonic edit flag server-side.
export const applyDiaryEditProvenance = (
  existing: FoodRecord,
  incoming: FoodRecord
): FoodRecord => {
  const result: FoodRecord = Object.fromEntries(
    Object.entries(incoming).filter(([field]) => !IMMUTABLE_DIARY_FIELD_SET.has(field))
  )

  for (const field of IMMUTABLE_DIARY_FIELDS) {
    if (Object.hasOwn(existing, field)) result[field] = existing[field]
  }

  // Omission means unchanged; an explicit null still clears the field.
  for (const field of RETAINED_WHEN_OMITTED) {
    if (!Object.hasOwn(incoming, field) && Object.hasOwn(existing, field)) {
      result[field] = existing[field]
    }
  }

  const materiallyEdited =
    existing.materiallyEdited === true ||
    incoming.materiallyEdited === true ||
    hasMaterialFoodChange(diaryMaterialValues(existing), diaryMaterialValues(result))

  if (materiallyEdited) result.materiallyEdited = true
  else delete result.materiallyEdited

  return result
}
