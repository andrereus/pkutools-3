import { describe, expect, it } from 'vitest'
import {
  hasMaterialFoodChange,
  normalizeFoodName,
  nutrientsEqual
} from '../shared/utils/material-food'

describe('material food changes', () => {
  const food = {
    name: 'Oat drink',
    phe: '50',
    kcal: 45,
    nutrients: { protein: '1', fat: 1.5, salt: 0.09 }
  }

  it('ignores representation-only differences', () => {
    expect(normalizeFoodName('  OAT DRINK ')).toBe('oat drink')
    expect(
      hasMaterialFoodChange(food, {
        name: 'OAT DRINK',
        phe: 50,
        kcal: '45',
        nutrients: { protein: 1, fat: '1.5', salt: 0.09 }
      })
    ).toBe(false)
  })

  it.each([
    [{ name: 'Soy drink' }, 'name'],
    [{ phe: 60 }, 'Phe'],
    [{ kcal: 50 }, 'kcal'],
    [{ nutrients: { protein: 2, fat: 1.5, salt: 0.09 } }, 'nutrients']
  ])('counts a change to %s as material', (change) => {
    expect(hasMaterialFoodChange(food, { ...food, ...change })).toBe(true)
  })

  it('treats absent, null, and empty nutrient sets alike', () => {
    expect(nutrientsEqual(undefined, null)).toBe(true)
    expect(nutrientsEqual({}, { protein: null })).toBe(true)
  })
})

describe('a corrected conversion', () => {
  it('counts as a material change even when no value moves', () => {
    const before = { name: 'Apple', phe: 54, kcal: 52, nutrients: { protein: 2 }, factor: 50 }

    expect(hasMaterialFoodChange(before, { ...before, factor: 27 })).toBe(true)
    expect(hasMaterialFoodChange(before, { ...before })).toBe(false)
  })

  it('does not fire on a record that never carried one', () => {
    const before = { name: 'Juice', phe: 10, kcal: 40, nutrients: null }

    expect(hasMaterialFoodChange(before, { ...before, factor: null })).toBe(false)
    expect(hasMaterialFoodChange(before, { ...before, factor: undefined })).toBe(false)
  })
})
