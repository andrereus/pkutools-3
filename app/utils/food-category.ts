import type { FoodType } from './nutrition'

// Suggesting a scanned product's food type from its Open Food Facts categories.
// The scanner keeps the conservative general factor until the user accepts the
// suggestion; this classifier never changes a calculation on its own.
//
// A product carries its whole category path, so broad ancestors are enough to
// match on. The hierarchy does not run where you would expect, though —
// preserved forms sit under `*-based-foods` rather than under the plain
// category — so each one is listed below in its own right instead of being left
// to the path.
//
// Only the three types below are ever guessed. 'other' is both the app's
// default and the highest factor (50 mg Phe per g protein), so anything
// unrecognised, ambiguous or composite falls back to it and the Phe comes out
// high rather than low — the direction that has someone eat less of a food, not
// more.

// Narrow group tags only. The broad ones mix unrelated foods and would pull
// products nothing like a vegetable onto the vegetable factor. What is left out
// is left out on purpose — legumes, nuts and potatoes all sit far from that
// factor, and land on 'other'.
const CATEGORY_FOOD_TYPES: Record<Exclude<FoodType, 'other'>, string[]> = {
  fruit: [
    'en:fruits',
    'en:fresh-fruits',
    'en:frozen-fruits',
    'en:canned-fruits',
    'en:dried-fruits'
  ],
  vegetable: [
    'en:vegetables',
    'en:fresh-vegetables',
    'en:frozen-vegetables',
    'en:canned-vegetables'
  ],
  meat: ['en:meats', 'en:fresh-meats', 'en:poultry', 'en:fishes', 'en:seafood']
}

// A dish is not its main ingredient: aubergines cooked in sauce carry
// `en:vegetables` and `en:meals` together, and what else is in there decides
// the protein as much as the vegetable does. These send the guess back to the
// default rather than to a lower factor.
//
// The dairy and cereal entries are here for the same reason and matter most:
// they are where the protein of a fruit-sounding product actually comes from.
// A fruit yogurt sits under `en:fermented-dairy-desserts`, a fruit muesli under
// `en:cereals-and-their-products`, and milk and wheat protein are nowhere near
// the fruit factor — 27 instead of 50 would understate their Phe by nearly
// half. `en:prepared-vegetables` is the same trap in vegetable form: frozen
// creamed spinach carries it, and the cream is the point.
const COMPOSITE_CATEGORIES = [
  'en:meals',
  'en:prepared-salads',
  'en:prepared-vegetables',
  'en:sandwiches',
  'en:pizzas',
  'en:soups',
  'en:sauces',
  'en:snacks',
  'en:desserts',
  'en:dairies',
  'en:cheeses',
  'en:yogurts',
  'en:breakfast-cereals'
]

/**
 * The food type a product's categories point at, or null when they point at
 * none, at more than one, or at a composite dish. Null means "leave the
 * default", never "this is a general food".
 */
export const foodTypeFromCategories = (categories: unknown): FoodType | null => {
  if (!Array.isArray(categories)) return null

  const tags = new Set(
    categories
      .filter((tag): tag is string => typeof tag === 'string')
      .map((tag) => tag.trim().toLowerCase())
  )
  if (tags.size === 0) return null
  if (COMPOSITE_CATEGORIES.some((tag) => tags.has(tag))) return null

  const matched = (
    Object.keys(CATEGORY_FOOD_TYPES) as Array<keyof typeof CATEGORY_FOOD_TYPES>
  ).filter((type) => CATEGORY_FOOD_TYPES[type].some((tag) => tags.has(tag)))

  // A product tagged as both meat and vegetables has no single answer, and
  // guessing one of them would be worse than not guessing.
  return matched.length === 1 ? matched[0]! : null
}
