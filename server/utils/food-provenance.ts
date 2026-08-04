import { hasMaterialFoodChange } from '../../shared/utils/material-food'

type FoodRecord = Record<string, unknown>

const IMMUTABLE_DIARY_FIELDS = [
  'itemId',
  'createdAt',
  'source',
  'sourceId',
  'factor',
  'addedFrom',
  'communityFoodKey'
] as const
const IMMUTABLE_DIARY_FIELD_SET = new Set<string>(IMMUTABLE_DIARY_FIELDS)

const diaryMaterialValues = (item: FoodRecord) => ({
  name: item.name,
  phe: item.pheReference,
  kcal: item.kcalReference,
  nutrients: item.nutrients
})

// A diary update replaces the complete log item. Preserve provenance from the
// stored copy and derive the monotonic edit flag server-side, so a stale or
// malformed client cannot erase either one.
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

  const materiallyEdited =
    existing.materiallyEdited === true ||
    incoming.materiallyEdited === true ||
    hasMaterialFoodChange(diaryMaterialValues(existing), diaryMaterialValues(incoming))

  if (materiallyEdited) result.materiallyEdited = true
  else delete result.materiallyEdited

  return result
}
