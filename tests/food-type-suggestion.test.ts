import { describe, it, expect, vi, beforeEach } from 'vitest'

// A food type decides which factor converts protein into Phe, and three of the
// four types are lower than the default. So the failure that matters here is a
// suggestion the app acts on when the model didn't actually give one: an
// unparsable answer, a failed call, or an empty name must all leave the caller
// on the type it already had.

const generateContent = vi.fn()
const confirm = vi.fn()

// The Nuxt auto-imports the composable resolves while a page is setting up.
vi.stubGlobal('useConfirm', () => ({ confirm }))
vi.stubGlobal('useI18n', () => ({
  // Enough to tell the messages apart, with the interpolated labels visible
  t: (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key
}))

vi.mock('firebase/app', () => ({ getApp: () => ({}) }))
vi.mock('firebase/ai', () => ({
  getAI: () => ({}),
  GoogleAIBackend: vi.fn(),
  getGenerativeModel: () => ({ generateContent })
}))

const answering = (text: string) => {
  generateContent.mockResolvedValue({ response: { text: () => text } })
}

const { parseFoodTypeAnswer, useFoodTypeSuggestion } =
  await import('../app/composables/useFoodTypeSuggestion')

describe('reading a food type out of a model answer', () => {
  it('accepts the four types the app converts with', () => {
    expect(parseFoodTypeAnswer('fruit')).toBe('fruit')
    expect(parseFoodTypeAnswer('vegetable')).toBe('vegetable')
    expect(parseFoodTypeAnswer('meat')).toBe('meat')
    expect(parseFoodTypeAnswer('other')).toBe('other')
  })

  it('tolerates surrounding whitespace and capitalisation', () => {
    expect(parseFoodTypeAnswer('  Fruit\n')).toBe('fruit')
    expect(parseFoodTypeAnswer('MEAT')).toBe('meat')
  })

  it('refuses anything that is not one of the four exact values', () => {
    // Each of these is a plausible model answer, and reading a type into any of
    // them would put a lower factor behind a value the model never returned.
    expect(parseFoodTypeAnswer('fruits')).toBeNull()
    expect(parseFoodTypeAnswer('Obst')).toBeNull()
    expect(parseFoodTypeAnswer('fruit or vegetable')).toBeNull()
    expect(parseFoodTypeAnswer('This is a fruit.')).toBeNull()
    expect(parseFoodTypeAnswer('')).toBeNull()
  })

  it('refuses a non-string, which JSON can hand back for any field', () => {
    expect(parseFoodTypeAnswer(null)).toBeNull()
    expect(parseFoodTypeAnswer(undefined)).toBeNull()
    expect(parseFoodTypeAnswer(0)).toBeNull()
    expect(parseFoodTypeAnswer(['fruit'])).toBeNull()
    expect(parseFoodTypeAnswer({ foodType: 'fruit' })).toBeNull()
  })
})

describe('suggesting a food type from a name', () => {
  beforeEach(() => {
    generateContent.mockReset()
  })

  it('returns the type the model named', async () => {
    answering('{"foodType": "vegetable"}')
    await expect(useFoodTypeSuggestion().suggestFoodType('Karotte')).resolves.toBe('vegetable')
  })

  it('survives the stray trailing brace a model can append', async () => {
    answering('{"foodType": "meat"}}')
    await expect(useFoodTypeSuggestion().suggestFoodType('Lachs')).resolves.toBe('meat')
  })

  it('returns null when the model declines to name one', async () => {
    answering('{"foodType": null}')
    await expect(useFoodTypeSuggestion().suggestFoodType('asdf')).resolves.toBeNull()
  })

  it('returns null on unusable output rather than guessing', async () => {
    answering('Sorry, I cannot help with that.')
    await expect(useFoodTypeSuggestion().suggestFoodType('Apfel')).resolves.toBeNull()
  })

  it('returns null when the call fails', async () => {
    generateContent.mockRejectedValue(new Error('RESOURCE_EXHAUSTED'))
    await expect(useFoodTypeSuggestion().suggestFoodType('Apfel')).resolves.toBeNull()
  })

  it('asks nothing at all for an empty or blank name', async () => {
    const { suggestFoodType } = useFoodTypeSuggestion()
    await expect(suggestFoodType('')).resolves.toBeNull()
    await expect(suggestFoodType('   ')).resolves.toBeNull()
    expect(generateContent).not.toHaveBeenCalled()
  })

  it('bounds the name it interpolates and strips what would break the prompt', async () => {
    answering('{"foodType": "other"}')
    const prefix = 'He said "stew"\n\tand '
    await useFoodTypeSuggestion().suggestFoodType(prefix + 'x'.repeat(300))

    const prompt = generateContent.mock.calls[0]![0] as string
    expect(prompt).not.toContain('\t')

    // The name reaches the prompt on one line, quoted and length-capped
    const name = prompt.split('\n')[0]!.match(/"(.*)"/)![1]!
    expect(name).toContain('\\"stew\\"')
    expect(name).not.toContain('\n')
    // The 200-character cap is applied before the quotes in the name are
    // escaped, so what holds exactly is the count of characters kept
    expect(name.replace(/[^x]/g, '')).toHaveLength(200 - prefix.length)
  })
})

describe('offering the correction', () => {
  beforeEach(() => {
    generateContent.mockReset()
    confirm.mockReset()
  })

  // What 20 g of protein in 100 g eaten comes to under each factor: 50 → 1000 mg
  // Phe, 46 → 920, 35 → 700, 27 → 540.
  const PHE_BY_TYPE = { other: 1000, meat: 920, vegetable: 700, fruit: 540 }

  const ask = (name: string, current: 'fruit' | 'vegetable' | 'meat' | 'other') =>
    useFoodTypeSuggestion().confirmFoodType(name, current, (type) => PHE_BY_TYPE[type])

  it('applies the suggestion the user accepts', async () => {
    answering('{"foodType": "fruit"}')
    confirm.mockResolvedValue(true)
    await expect(ask('Apfel', 'other')).resolves.toBe('fruit')
  })

  it('keeps the chosen type when the user declines', async () => {
    answering('{"foodType": "fruit"}')
    confirm.mockResolvedValue(false)
    await expect(ask('Apfel', 'other')).resolves.toBe('other')
  })

  it('keeps the chosen type when the dialog is dismissed', async () => {
    // A dismissal resolves the same way a decline does, so the save goes on with
    // the type the user picked themselves — never with a guess they didn't see.
    answering('{"foodType": "vegetable"}')
    confirm.mockResolvedValue(undefined)
    await expect(ask('Karotte', 'other')).resolves.toBe('other')
  })

  it('asks nothing when the model names the type already selected', async () => {
    answering('{"foodType": "meat"}')
    await expect(ask('Lachs', 'meat')).resolves.toBe('meat')
    expect(confirm).not.toHaveBeenCalled()
  })

  it('asks nothing when there is no suggestion to make', async () => {
    generateContent.mockRejectedValue(new Error('offline'))
    await expect(ask('Apfel', 'other')).resolves.toBe('other')
    expect(confirm).not.toHaveBeenCalled()
  })

  it('offers the correction in both directions, not only downwards', async () => {
    // The general type carries the highest factor, so a suggestion pointing back
    // at it is the one that raises a Phe value the user set too low.
    answering('{"foodType": "other"}')
    confirm.mockResolvedValue(true)
    await expect(ask('Fruchtjoghurt', 'fruit')).resolves.toBe('other')
  })

  it('names both types in the question and on its buttons', async () => {
    answering('{"foodType": "fruit"}')
    confirm.mockResolvedValue(false)
    await ask('Apfel', 'other')

    const options = confirm.mock.calls[0]![0]
    expect(options.message).toContain('phe-calculator.fruit')
    expect(options.message).toContain('phe-calculator.other')
    expect(options.confirmLabel).toContain('phe-calculator.fruit')
    expect(options.cancelLabel).toContain('phe-calculator.other')
    // Correcting a factor is not a destructive act, and the dialog must not
    // dress it up as one
    expect(options.variant).toBe('default')
  })

  it('quotes what the entry becomes, in mg Phe, not just the factor names', async () => {
    // The number is the thing being decided; a factor name means nothing on its
    // own to someone counting Phe for the day.
    answering('{"foodType": "fruit"}')
    confirm.mockResolvedValue(false)
    await ask('Apfel', 'other')

    const { message } = confirm.mock.calls[0]![0]
    expect(message).toContain('"current":1000')
    expect(message).toContain('"corrected":540')
  })
})
