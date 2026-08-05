// How a food's values were arrived at, in words, for the two screens that show
// a stored food before it is used: food search and own food. One builder rather
// than two, so the same food never describes itself differently depending on
// where it is opened.

// The origins worth naming. The reference databases are deliberately absent:
// they carry a badge of their own in the search list and are named in the
// search info below it, so a second label would only repeat them.
const SOURCE_LABEL_KEYS: Record<string, string> = {
  manual: 'food-search.source-manual',
  barcode: 'food-search.source-barcode',
  'ai-label': 'food-search.source-ai-label',
  'ai-estimate': 'food-search.source-ai-estimate'
}

interface FoodOrigin {
  source?: string | null
  sourceId?: string | null
  materiallyEdited?: boolean
}

/**
 * The origin of a food's values, or null when it has none worth naming — a
 * record written before provenance existed, or one from a reference database.
 * `t` is the caller's translator.
 */
export const foodSourceLabel = (
  food: FoodOrigin | null | undefined,
  t: (key: string) => string
): string | null => {
  const key = food?.source ? SOURCE_LABEL_KEYS[food.source] : undefined
  if (!key) return null

  // The barcode identifies the exact product, which is what makes a shared food
  // verifiable — worth showing next to the origin it came from.
  const code = food?.source === 'barcode' && food.sourceId ? food.sourceId : null
  const origin = code ? `${t(key)} · ${code}` : t(key)

  // The origin itself never changes; this says the values shown have since
  // moved away from it.
  return food?.materiallyEdited === true
    ? `${origin} · ${t('food-search.materially-edited')}`
    : origin
}
