import { describe, it, expect } from 'vitest'
import { foodTypeFromCategories } from '../app/utils/food-category'

// The guess decides which factor converts a scanned product's protein into Phe,
// and a guess that is too low understates the Phe of everything the user logs
// from it. Every tag list below is real Open Food Facts data, copied from the
// API, because the failure mode here is a plausible-looking tag that doesn't
// mean what it reads like.

describe('guessing a food type from Open Food Facts categories', () => {
  it('reads the group tag out of a full category path', () => {
    // Sardines: the specific tags are useless on their own, the group tag isn't.
    expect(
      foodTypeFromCategories([
        'en:seafood',
        'en:fishes-and-their-products',
        'en:canned-foods',
        'en:fishes',
        'en:fatty-fishes',
        'en:canned-fishes',
        'en:sardines'
      ])
    ).toBe('meat')

    expect(
      foodTypeFromCategories([
        'en:meats-and-their-products',
        'en:meats',
        'en:pork-and-its-products',
        'en:prepared-meats',
        'en:hams',
        'en:prepared-pork-meats'
      ])
    ).toBe('meat')

    expect(
      foodTypeFromCategories([
        'en:plant-based-foods-and-beverages',
        'en:plant-based-foods',
        'en:fruits-and-vegetables-based-foods',
        'en:vegetable-based-foods-and-beverages',
        'en:vegetables-based-foods',
        'en:vegetables'
      ])
    ).toBe('vegetable')
  })

  // The reason the broad tags are not in the map: this is a tube of crisps, and
  // Open Food Facts files it under two vegetable-sounding categories.
  it('does not take a crisp for a vegetable', () => {
    expect(
      foodTypeFromCategories([
        'en:plant-based-foods-and-beverages',
        'en:plant-based-foods',
        'en:fruits-and-vegetables-based-foods',
        'en:snacks',
        'en:vegetable-based-foods-and-beverages',
        'en:cereals-and-potatoes'
      ])
    ).toBeNull()
  })

  // A cooked dish carries its main ingredient's tag, but what else is in it
  // decides the protein just as much.
  it('leaves a composite dish alone', () => {
    expect(
      foodTypeFromCategories([
        'en:plant-based-foods',
        'en:vegetables',
        'en:canned-foods',
        'en:meals'
      ])
    ).toBeNull()
  })

  it('gives up when the tags point at two different types', () => {
    expect(foodTypeFromCategories(['en:vegetables', 'en:meats'])).toBeNull()
  })

  // The costliest mistake available: milk and wheat protein are close to the
  // general factor, and a fruit-sounding product built on either of them would
  // be understated by nearly half if the fruit factor won.
  it('does not let a fruit-flavoured dairy or cereal product become fruit', () => {
    expect(foodTypeFromCategories(['en:dairies', 'en:yogurts', 'en:fruits'])).toBeNull()
    expect(foodTypeFromCategories(['en:breakfast-cereals', 'en:dried-fruits'])).toBeNull()
    expect(foodTypeFromCategories(['en:cheeses', 'en:fruits'])).toBeNull()
  })

  // Real frozen "vegetable" products, both of which contain more than the
  // vegetable: creamed spinach and a seasoned pan mix.
  it('leaves prepared produce on the default', () => {
    expect(
      foodTypeFromCategories([
        'en:plant-based-foods-and-beverages',
        'en:plant-based-foods',
        'en:fruits-and-vegetables-based-foods',
        'en:vegetable-based-foods-and-beverages',
        'en:frozen-foods',
        'en:vegetables-based-foods',
        'en:frozen-plant-based-foods',
        'en:prepared-vegetables'
      ])
    ).toBeNull()

    expect(
      foodTypeFromCategories([
        'en:plant-based-foods',
        'en:vegetable-based-foods-and-beverages',
        'en:frozen-foods',
        'en:meals',
        'en:vegetables-based-foods',
        'en:frozen-plant-based-foods'
      ])
    ).toBeNull()
  })

  it('leaves an unrecognised product on the default', () => {
    // Nutella
    expect(
      foodTypeFromCategories([
        'en:breakfasts',
        'en:spreads',
        'en:sweet-spreads',
        'en:confectionary-based-spreads'
      ])
    ).toBeNull()
  })

  // Protein composition is what the factor describes, and drying doesn't change
  // it — only the concentration, which the per-100 g values already carry.
  it('treats preserved produce as the produce it came from', () => {
    expect(foodTypeFromCategories(['en:dried-fruits'])).toBe('fruit')
    expect(foodTypeFromCategories(['en:frozen-vegetables'])).toBe('vegetable')
  })

  // Open Food Facts is user-edited and the field is optional, so the input is
  // whatever the API happened to return.
  it('survives missing and malformed input', () => {
    expect(foodTypeFromCategories(undefined)).toBeNull()
    expect(foodTypeFromCategories(null)).toBeNull()
    expect(foodTypeFromCategories([])).toBeNull()
    expect(foodTypeFromCategories('en:fruits')).toBeNull()
    expect(foodTypeFromCategories([null, 42, { tag: 'en:fruits' }])).toBeNull()
    // Untranslated entries occur in the live data and are simply not slugs
    expect(foodTypeFromCategories(['en:Petit-déjeuners', 'en:Fruits'])).toBe('fruit')
  })
})
