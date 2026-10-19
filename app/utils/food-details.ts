import { foodSourceLabel } from './food-source-label'
import { nutrientRows, PHE_FACTORS, type NutrientRow } from './nutrition'

// A food's details as label–value rows, built once for every screen that
// shows them: the nutrients it has, where its values came from, and the Phe
// factor they were calculated with.

interface DetailFood {
  nutrients?: Record<string, number | null | undefined> | null
  source?: string | null
  sourceId?: string | null
  materiallyEdited?: boolean
  factor?: unknown
}

export interface DetailRow {
  key: string
  label: string
  value: string
  /** A second line, such as values that changed since their source. */
  note?: string
}

export const foodDetailRows = (
  food: DetailFood,
  weight: number,
  t: (key: string) => string
): { nutrients: NutrientRow[]; details: DetailRow[] } => {
  const details: DetailRow[] = []

  // The edit is its own line rather than one more part of a joined string.
  const source = foodSourceLabel({ ...food, materiallyEdited: false }, t)
  if (source) {
    details.push({
      key: 'source',
      label: t('community.detail-source'),
      value: source,
      ...(food.materiallyEdited === true && { note: t('food-search.materially-edited') })
    })
  }

  const type = Object.entries(PHE_FACTORS).find(([, factor]) => factor === Number(food.factor))?.[0]
  if (type) {
    details.push({
      key: 'factor',
      label: t('community.detail-factor'),
      value: t(`phe-calculator.${type}`)
    })
  }

  return { nutrients: nutrientRows(food.nutrients, weight, t), details }
}
