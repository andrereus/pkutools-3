import { describe, it, expect } from 'vitest'
import { parseModelJson } from '../app/utils/model-json'

describe('parseModelJson', () => {
  it('ignores a stray closing brace after a complete object', () => {
    const response = `{
  "name": "Gemischter Salat mit Dressing",
  "phePer100g": 40,
  "weightInGrams": 150,
  "explanation": "Gemischter Blattsalat mit Karotten."
}
}
`
    expect(parseModelJson(response)).toEqual({
      name: 'Gemischter Salat mit Dressing',
      phePer100g: 40,
      weightInGrams: 150,
      explanation: 'Gemischter Blattsalat mit Karotten.'
    })
  })

  it('keeps nested objects whole', () => {
    expect(parseModelJson('{"a":{"b":{"c":1}},"d":2}')).toEqual({ a: { b: { c: 1 } }, d: 2 })
  })

  it('ignores braces and escaped quotes inside strings', () => {
    expect(parseModelJson('{"explanation":"a } and a { and a \\" quote","phePer100g":40}')).toEqual(
      {
        explanation: 'a } and a { and a " quote',
        phePer100g: 40
      }
    )
  })

  it('skips prose the model wrote before the object', () => {
    expect(parseModelJson('Here is the result:\n```json\n{"phePer100g":40}\n```')).toEqual({
      phePer100g: 40
    })
  })

  it('returns null for anything it cannot read an object out of', () => {
    // A truncated response, which is a real failure rather than a decorated one
    expect(parseModelJson('{"name":"Salat","phePer100')).toBeNull()
    expect(parseModelJson('{"a":}')).toBeNull()
    expect(parseModelJson('no json here')).toBeNull()
    expect(parseModelJson('')).toBeNull()
    expect(parseModelJson(undefined)).toBeNull()
  })
})
