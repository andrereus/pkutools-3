import { describe, it, expect, vi, beforeEach } from 'vitest'

// Saving a food next to a diary entry has three outcomes and one rule: the
// diary entry survives all of them. What the user is told afterwards is the
// only signal that the food did or didn't make it, so each outcome has to pick
// the right message — and the failure has to be reported once, by this
// composable, rather than twice.

const saveOwnFood = vi.fn()
const success = vi.fn()
const warning = vi.fn()

// The Nuxt auto-imports the composable reaches for at call time.
vi.stubGlobal('useApi', () => ({ saveOwnFood }))
vi.stubGlobal('useNotifications', () => ({ success, warning }))
vi.stubGlobal('useI18n', () => ({
  // Enough to tell the messages apart, with the interpolated reason visible
  t: (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
  te: (key: string) => key !== 'errors.no-such-code'
}))

const { resolveSaveNotes, useSaveToOwnFood } = await import('../app/composables/useSaveToOwnFood')

const FOOD = { name: 'Oat drink', phe: 50, kcal: 45, note: null, source: 'barcode' as const }

beforeEach(() => {
  saveOwnFood.mockReset()
  success.mockReset()
  warning.mockReset()
})

describe('saving a food alongside a diary entry', () => {
  it('reports nothing on its own, so one message can tell the whole story', async () => {
    saveOwnFood.mockRejectedValue({
      statusCode: 403,
      data: { data: { code: 'limit-reached' } }
    })
    const { saveAlongsideDiary } = useSaveToOwnFood()

    const outcome = await saveAlongsideDiary(FOOD)

    // The request layer was told to stay quiet
    expect(saveOwnFood).toHaveBeenCalledWith(FOOD, { silent: true })
    expect(success).not.toHaveBeenCalled()
    expect(warning).not.toHaveBeenCalled()
    expect(outcome.failure).toBe('errors.limit-reached')
  })

  // The diary write happens after this returns, so throwing here would take the
  // entry down with the food. A network failure also carries no code, which is
  // the other way the reason falls back to the generic one.
  it('never throws, whatever the save did', async () => {
    saveOwnFood.mockRejectedValue(new Error('offline'))
    const { saveAlongsideDiary } = useSaveToOwnFood()

    await expect(saveAlongsideDiary(FOOD)).resolves.toMatchObject({
      failure: 'errors.unexpected',
      alreadyExists: false
    })
  })

  // A code the locales don't have yet must reach the user as a sentence, not as
  // a raw slug.
  it('falls back to the generic reason for an untranslated code', async () => {
    saveOwnFood.mockRejectedValue({
      statusCode: 400,
      data: { data: { code: 'no-such-code' } }
    })
    const { saveAlongsideDiary } = useSaveToOwnFood()

    await expect(saveAlongsideDiary(FOOD)).resolves.toMatchObject({
      failure: 'errors.unexpected'
    })
  })

  it('passes a rescanned product back as already saved', async () => {
    saveOwnFood.mockResolvedValue({ success: true, key: 'entry1', alreadyExists: true })
    const { saveAlongsideDiary } = useSaveToOwnFood()

    await expect(saveAlongsideDiary({ ...FOOD, shared: true })).resolves.toMatchObject({
      alreadyExists: true,
      failure: null,
      wantedToShare: true
    })
  })
})

describe('reporting the save', () => {
  const outcomeOf = async (result: unknown) => {
    saveOwnFood.mockResolvedValue(result)
    const { saveAlongsideDiary } = useSaveToOwnFood()
    return saveAlongsideDiary(FOOD)
  }

  it('confirms an ordinary save', async () => {
    const { reportSaved } = useSaveToOwnFood()

    reportSaved(await outcomeOf({ success: true, key: 'entry1' }))

    expect(success).toHaveBeenCalledWith('common.saved')
    expect(warning).not.toHaveBeenCalled()
  })

  it('says the entry was logged and why the food was not', async () => {
    saveOwnFood.mockRejectedValue({
      statusCode: 409,
      data: { data: { code: 'duplicate-own-food' } }
    })
    const { saveAlongsideDiary, reportSaved } = useSaveToOwnFood()

    reportSaved(await saveAlongsideDiary(FOOD))

    expect(warning).toHaveBeenCalledWith(
      'own-food.diary-only:{"reason":"errors.duplicate-own-food"}'
    )
    expect(success).not.toHaveBeenCalled()
  })

  // A rescan that also asked to share published nothing, so the message has to
  // point at where sharing is still possible.
  it('distinguishes a rescan that wanted to share from one that did not', async () => {
    saveOwnFood.mockResolvedValue({ success: true, alreadyExists: true })
    const { saveAlongsideDiary, reportSaved } = useSaveToOwnFood()

    reportSaved(await saveAlongsideDiary({ ...FOOD, shared: false }))
    expect(success).toHaveBeenCalledWith('own-food.already-saved')

    reportSaved(await saveAlongsideDiary({ ...FOOD, shared: true }))
    expect(success).toHaveBeenCalledWith('own-food.already-saved-share')
  })

  it('confirms plainly when no own food was asked for', () => {
    const { reportSaved } = useSaveToOwnFood()

    reportSaved(null)

    expect(success).toHaveBeenCalledWith('common.saved')
  })
})

// Notes are deliberately not retained as composable state: the current save
// resolves them once, so no note can leak into the next food.
describe('the note', () => {
  it('is passed through untouched and kept nowhere', async () => {
    saveOwnFood.mockResolvedValue({ success: true, key: 'entry1' })
    const { saveAlongsideDiary } = useSaveToOwnFood()

    await saveAlongsideDiary({ ...FOOD, note: 'Unsweetened' })

    expect(saveOwnFood).toHaveBeenCalledWith(expect.objectContaining({ note: 'Unsweetened' }), {
      silent: true
    })
    expect(Object.keys(useSaveToOwnFood())).toEqual(['saveAlongsideDiary', 'reportSaved'])
  })

  it.each([
    {
      name: 'uses an estimate explanation in both records',
      input: {
        useOwnFoodNote: false,
        saveToOwnFood: true,
        ownFoodNote: 'stale hidden note',
        defaultDiaryNote: 'Estimated from a typical serving'
      },
      expected: {
        diary: 'Estimated from a typical serving',
        ownFood: 'Estimated from a typical serving'
      }
    },
    {
      name: 'uses a visible label note in both records',
      input: {
        useOwnFoodNote: true,
        saveToOwnFood: true,
        ownFoodNote: '  Per prepared serving  ',
        defaultDiaryNote: null
      },
      expected: { diary: 'Per prepared serving', ownFood: 'Per prepared serving' }
    },
    {
      name: 'ignores a hidden label note after Own Food is unticked',
      input: {
        useOwnFoodNote: true,
        saveToOwnFood: false,
        ownFoodNote: 'note from the visible field before unticking',
        defaultDiaryNote: null
      },
      expected: { diary: null, ownFood: null }
    }
  ])('$name', ({ input, expected }) => {
    expect(resolveSaveNotes(input)).toEqual(expected)
  })
})
