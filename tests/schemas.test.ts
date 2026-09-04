import { describe, it, expect } from 'vitest'
import {
  DiaryEntrySchema,
  LabValueSchema,
  OwnFoodSchema,
  OwnFoodSaveSchema,
  OwnFoodUpdateSchema,
  CommunityVoteSchema,
  CommunityFoodCommentSchema,
  CommunityFoodCommentDeleteSchema,
  CreateDaySchema,
  UpdateDaySchema,
  UpdateFoodItemSchema,
  DeleteFoodItemSchema,
  LabValueUpdateSchema,
  SettingsUpdateSchema,
  ConsentSchema,
  GettingStartedSchema,
  ResetSchema
} from '../server/types/schemas'

// Write endpoints validate request bodies with these schemas before persisting
// them to Firebase, so a loosened rule widens what those endpoints accept.

const validEntry = {
  name: 'Apple',
  weight: 150,
  phe: 27,
  kcal: 78
}

describe('DiaryEntrySchema', () => {
  it('accepts a minimal valid entry', () => {
    const result = DiaryEntrySchema.safeParse(validEntry)
    expect(result.success).toBe(true)
  })

  it('coerces numeric strings', () => {
    const result = DiaryEntrySchema.parse({
      ...validEntry,
      weight: '150',
      phe: '27',
      kcal: '78'
    })
    expect(result.weight).toBe(150)
    expect(result.phe).toBe(27)
    expect(result.kcal).toBe(78)
  })

  it('requires a non-empty name', () => {
    expect(DiaryEntrySchema.safeParse({ ...validEntry, name: '' }).success).toBe(false)
    expect(DiaryEntrySchema.safeParse({ ...validEntry, name: undefined }).success).toBe(false)
  })

  it('caps the name at 200 characters', () => {
    expect(DiaryEntrySchema.safeParse({ ...validEntry, name: 'a'.repeat(200) }).success).toBe(true)
    expect(DiaryEntrySchema.safeParse({ ...validEntry, name: 'a'.repeat(201) }).success).toBe(false)
  })

  // A 0 g entry is never a real food.
  it('rejects a non-positive weight', () => {
    expect(DiaryEntrySchema.safeParse({ ...validEntry, weight: 0 }).success).toBe(false)
    expect(DiaryEntrySchema.safeParse({ ...validEntry, weight: -150 }).success).toBe(false)
  })

  it('caps weight at 10 kg', () => {
    expect(DiaryEntrySchema.safeParse({ ...validEntry, weight: 10000 }).success).toBe(true)
    expect(DiaryEntrySchema.safeParse({ ...validEntry, weight: 10001 }).success).toBe(false)
  })

  it('rejects negative phe or kcal but allows an explicit 0', () => {
    expect(DiaryEntrySchema.safeParse({ ...validEntry, phe: -1 }).success).toBe(false)
    expect(DiaryEntrySchema.safeParse({ ...validEntry, kcal: -1 }).success).toBe(false)
    expect(DiaryEntrySchema.safeParse({ ...validEntry, phe: 0, kcal: 0 }).success).toBe(true)
  })

  it('rejects a non-numeric phe rather than storing NaN', () => {
    for (const value of ['abc', '12abc', NaN, Infinity, {}]) {
      expect(
        DiaryEntrySchema.safeParse({ ...validEntry, phe: value }).success,
        `phe ${value}`
      ).toBe(false)
    }
  })

  // Weight carries the strictest guard: `.positive()` refuses the 0 that every
  // blank value coerces to, so none of them can be read as "some food".
  it('rejects a weight that coerces to zero or NaN', () => {
    for (const value of [null, undefined, '', '   ', false, [], {}, 'abc', NaN, Infinity]) {
      expect(
        DiaryEntrySchema.safeParse({ ...validEntry, weight: value }).success,
        `weight ${JSON.stringify(value)}`
      ).toBe(false)
    }
  })

  // Reject values Number() would turn into plausible nutrient values.
  it('rejects values that coerce to 0 or 1', () => {
    for (const value of [null, '', '   ', false, true, [], [150], {}]) {
      expect(
        DiaryEntrySchema.safeParse({ ...validEntry, phe: value }).success,
        `phe ${JSON.stringify(value)}`
      ).toBe(false)
    }
    // The same surface on the other schemas that take numbers.
    expect(CreateDaySchema.safeParse({ date: '2026-07-26', phe: '', kcal: null }).success).toBe(
      false
    )
    expect(OwnFoodSchema.safeParse({ name: 'Shake', phe: [], kcal: false }).success).toBe(false)
    expect(
      SettingsUpdateSchema.safeParse({ maxPhe: true }).success,
      'settings are numbers too'
    ).toBe(false)
  })

  // Narrowing must not break the strings legacy records and form fields hold.
  it('still accepts a number written as a string', () => {
    expect(DiaryEntrySchema.parse({ ...validEntry, phe: '150' }).phe).toBe(150)
    expect(DiaryEntrySchema.parse({ ...validEntry, phe: ' 150 ' }).phe).toBe(150)
    expect(DiaryEntrySchema.parse({ ...validEntry, weight: '150' }).weight).toBe(150)
    expect(DiaryEntrySchema.parse({ ...validEntry, phe: '0' }).phe).toBe(0)
  })

  // An explicit 0 is a real value — spirits and oils contain no Phe — and has
  // to stay distinguishable from the blanks rejected above.
  it('keeps accepting an explicit zero', () => {
    expect(DiaryEntrySchema.parse({ ...validEntry, phe: 0, kcal: 0 }).phe).toBe(0)
    expect(DiaryEntrySchema.parse({ ...validEntry, pheReference: 0 }).pheReference).toBe(0)
  })

  it('caps the note at 500 characters', () => {
    expect(DiaryEntrySchema.safeParse({ ...validEntry, note: 'a'.repeat(500) }).success).toBe(true)
    expect(DiaryEntrySchema.safeParse({ ...validEntry, note: 'a'.repeat(501) }).success).toBe(false)
  })

  it('allows null for the optional reference and annotation fields', () => {
    const result = DiaryEntrySchema.safeParse({
      ...validEntry,
      emoji: null,
      icon: null,
      pheReference: null,
      kcalReference: null,
      note: null,
      communityFoodKey: null
    })
    expect(result.success).toBe(true)
  })

  it('strips unknown keys', () => {
    const result = DiaryEntrySchema.parse({ ...validEntry, isAdmin: true, __proto__polluted: 1 })
    expect(result).not.toHaveProperty('isAdmin')
    expect(result).not.toHaveProperty('__proto__polluted')
  })

  it('validates round-tripped server timestamps', () => {
    expect(DiaryEntrySchema.safeParse({ ...validEntry, createdAt: 1730000000000 }).success).toBe(
      true
    )
    expect(DiaryEntrySchema.safeParse({ ...validEntry, createdAt: -1 }).success).toBe(false)
    expect(DiaryEntrySchema.safeParse({ ...validEntry, createdAt: 1.5 }).success).toBe(false)
  })

  it('validates the stable diary item id', () => {
    expect(DiaryEntrySchema.parse({ ...validEntry, itemId: '-Nitem123' }).itemId).toBe('-Nitem123')
    expect(DiaryEntrySchema.safeParse({ ...validEntry, itemId: '' }).success).toBe(false)
    expect(DiaryEntrySchema.safeParse({ ...validEntry, itemId: 'a'.repeat(65) }).success).toBe(
      false
    )
  })
})

// Provenance travels with an entry so the diary and the diet report can say
// where a value came from, and so a later feature can decide what may be
// re-shared. Zod strips whatever it doesn't declare, so anything missing here
// is silently dropped on its way to Firebase.
describe('DiaryEntrySchema provenance', () => {
  it('accepts nutrients, factor, source and sourceId', () => {
    const result = DiaryEntrySchema.parse({
      ...validEntry,
      nutrients: { protein: 11.375, fat: 7.09, carbs: 53.7, sugar: 1.08, fiber: 9.3, salt: 0.02 },
      factor: 46,
      source: 'bls',
      sourceId: 'C131000'
    })
    expect(result.nutrients).toEqual({
      protein: 11.375,
      fat: 7.09,
      carbs: 53.7,
      sugar: 1.08,
      fiber: 9.3,
      salt: 0.02
    })
    expect(result).toMatchObject({ factor: 46, source: 'bls', sourceId: 'C131000' })
  })

  // Sources publish different subsets — a scanned product often carries only
  // protein — so a partial nutrients object has to survive.
  it('accepts a partial nutrients object and drops unknown nutrients', () => {
    const result = DiaryEntrySchema.parse({
      ...validEntry,
      nutrients: { protein: 2.4, vitaminC: 12 }
    })
    expect(result.nutrients).toEqual({ protein: 2.4 })
  })

  it('keeps the decimals the source published rather than rounding', () => {
    const result = DiaryEntrySchema.parse({
      ...validEntry,
      pheReference: 105.8,
      nutrients: { protein: 2.3 },
      factor: 46
    })
    expect(result.pheReference).toBe(105.8)
    expect(result.nutrients?.protein).toBe(2.3)
  })

  it('rejects negative nutrients', () => {
    expect(DiaryEntrySchema.safeParse({ ...validEntry, nutrients: { protein: -1 } }).success).toBe(
      false
    )
  })

  it('rejects an unknown source', () => {
    expect(DiaryEntrySchema.safeParse({ ...validEntry, source: 'bls' }).success).toBe(true)
    expect(DiaryEntrySchema.safeParse({ ...validEntry, source: 'wikipedia' }).success).toBe(false)
    expect(DiaryEntrySchema.safeParse({ ...validEntry, source: '' }).success).toBe(false)
  })

  it('rejects a non-positive or implausible factor', () => {
    expect(DiaryEntrySchema.safeParse({ ...validEntry, factor: 0 }).success).toBe(false)
    expect(DiaryEntrySchema.safeParse({ ...validEntry, factor: -46 }).success).toBe(false)
    expect(DiaryEntrySchema.safeParse({ ...validEntry, factor: 101 }).success).toBe(false)
  })

  it('caps sourceId so a barcode field cannot carry a payload', () => {
    expect(DiaryEntrySchema.safeParse({ ...validEntry, sourceId: 'a'.repeat(64) }).success).toBe(
      true
    )
    expect(DiaryEntrySchema.safeParse({ ...validEntry, sourceId: 'a'.repeat(65) }).success).toBe(
      false
    )
  })

  // Entries written before provenance existed must stay valid, and null has to
  // survive because the diary rebuilds the whole entry on every edit.
  it('accepts an entry without provenance, and null for every field', () => {
    expect(DiaryEntrySchema.safeParse(validEntry).success).toBe(true)
    expect(
      DiaryEntrySchema.safeParse({
        ...validEntry,
        nutrients: null,
        factor: null,
        source: null,
        sourceId: null
      }).success
    ).toBe(true)
  })

  // Own foods carry the same provenance, which is what a later feature reads to
  // decide whether an entry may be shared with the community.
  it('carries the same fields on own food', () => {
    const result = OwnFoodSchema.parse({
      name: 'Protein shake',
      phe: 420,
      kcal: 120,
      nutrients: { protein: 8.4 },
      factor: 50,
      source: 'manual'
    })
    expect(result).toMatchObject({ factor: 50, source: 'manual' })
    expect(result.nutrients).toEqual({ protein: 8.4 })
  })

  // `source` is where the values came from, `addedFrom` which list the entry
  // was picked out of. Keeping them apart is what stops a food logged from Own
  // Food a week after it was scanned from losing the barcode it was read off.
  it('records the values origin and the list separately', () => {
    const result = DiaryEntrySchema.parse({
      ...validEntry,
      source: 'barcode',
      sourceId: '4009233001234',
      addedFrom: 'own-food'
    })
    expect(result).toMatchObject({
      source: 'barcode',
      sourceId: '4009233001234',
      addedFrom: 'own-food'
    })
  })

  it('accepts an optional material-edit flag and rejects non-booleans', () => {
    expect(DiaryEntrySchema.safeParse({ ...validEntry, materiallyEdited: true }).success).toBe(true)
    expect(OwnFoodSchema.safeParse({ ...validEntry, materiallyEdited: false }).success).toBe(true)
    expect(DiaryEntrySchema.safeParse({ ...validEntry, materiallyEdited: 'true' }).success).toBe(
      false
    )
  })

  it('accepts only a collection as addedFrom', () => {
    const withAddedFrom = (addedFrom: unknown) =>
      DiaryEntrySchema.safeParse({ ...validEntry, addedFrom }).success

    expect(withAddedFrom('community')).toBe(true)
    expect(withAddedFrom(null)).toBe(true)
    expect(withAddedFrom(undefined)).toBe(true)
    // A value origin is not a collection
    expect(withAddedFrom('barcode')).toBe(false)
    expect(withAddedFrom('bls')).toBe(false)
    expect(withAddedFrom('')).toBe(false)
  })

  // Entries written before the split carry the list in `source`, and the diary
  // revalidates the whole entry on every edit — so those values have to stay
  // parseable even though nothing writes them anymore.
  it('still accepts a legacy entry whose source is the list it came from', () => {
    expect(DiaryEntrySchema.safeParse({ ...validEntry, source: 'own-food' }).success).toBe(true)
    expect(DiaryEntrySchema.safeParse({ ...validEntry, source: 'community' }).success).toBe(true)
  })

  // Own foods and community foods are the collections; nothing adds them from
  // one, so the field is not part of their shape.
  it('leaves addedFrom off an own food', () => {
    const result = OwnFoodSchema.parse({
      name: 'Protein shake',
      phe: 420,
      kcal: 120,
      addedFrom: 'own-food'
    })
    expect(result).not.toHaveProperty('addedFrom')
  })
})

describe('LabValueSchema', () => {
  it('accepts a phe-only and a tyrosine-only reading', () => {
    expect(LabValueSchema.safeParse({ date: '2026-07-26', phe: 240 }).success).toBe(true)
    expect(LabValueSchema.safeParse({ date: '2026-07-26', tyrosine: 50 }).success).toBe(true)
  })

  // An omitted key is not a provided measurement.
  it('rejects a reading with neither phe nor tyrosine', () => {
    expect(LabValueSchema.safeParse({ date: '2026-07-26' }).success).toBe(false)
    expect(LabValueSchema.safeParse({ date: '2026-07-26', phe: null }).success).toBe(false)
    expect(
      LabValueSchema.safeParse({ date: '2026-07-26', phe: null, tyrosine: null }).success
    ).toBe(false)
    expect(
      LabValueSchema.safeParse({ date: '2026-07-26', phe: undefined, tyrosine: undefined }).success
    ).toBe(false)
  })

  it('enforces a zero-padded YYYY-MM-DD date', () => {
    expect(LabValueSchema.safeParse({ date: '2026-7-4', phe: 240 }).success).toBe(false)
    expect(LabValueSchema.safeParse({ date: '26-07-04', phe: 240 }).success).toBe(false)
    expect(LabValueSchema.safeParse({ date: '2026/07/04', phe: 240 }).success).toBe(false)
    expect(LabValueSchema.safeParse({ date: '', phe: 240 }).success).toBe(false)
  })

  // 0 is not a measurable result.
  it('rejects non-positive lab values', () => {
    expect(LabValueSchema.safeParse({ date: '2026-07-26', phe: 0 }).success).toBe(false)
    expect(LabValueSchema.safeParse({ date: '2026-07-26', phe: -240 }).success).toBe(false)
    expect(LabValueSchema.safeParse({ date: '2026-07-26', tyrosine: 0 }).success).toBe(false)
  })

  // Requiring a positive value is what makes these fields immune to the blank
  // coercion the diary totals allow: '' and [] coerce to 0, and 0 is refused.
  it('rejects a blank lab value', () => {
    for (const value of ['', '   ', false, []]) {
      expect(
        LabValueSchema.safeParse({ date: '2026-07-26', phe: value }).success,
        `phe ${JSON.stringify(value)}`
      ).toBe(false)
    }
    // An explicit null still means "this one wasn't measured".
    expect(LabValueSchema.parse({ date: '2026-07-26', phe: null, tyrosine: 50 }).phe).toBeNull()
  })
})

describe('OwnFoodSchema', () => {
  // Nothing reaches the community database without the user opting in.
  it('defaults `shared` to false', () => {
    const result = OwnFoodSchema.parse({ name: 'My shake', phe: 12, kcal: 90 })
    expect(result.shared).toBe(false)
  })

  it('keeps an explicit shared:true', () => {
    expect(OwnFoodSchema.parse({ name: 'My shake', phe: 12, kcal: 90, shared: true }).shared).toBe(
      true
    )
  })

  it('rejects negative nutrition values', () => {
    expect(OwnFoodSchema.safeParse({ name: 'x', phe: -1, kcal: 0 }).success).toBe(false)
    expect(OwnFoodSchema.safeParse({ name: 'x', phe: 0, kcal: -1 }).success).toBe(false)
  })

  it('restricts the community language to the four supported locales', () => {
    const base = { name: 'x', phe: 1, kcal: 1 }
    for (const locale of ['en', 'de', 'es', 'fr']) {
      expect(OwnFoodSaveSchema.safeParse({ ...base, locale }).success).toBe(true)
    }
    expect(OwnFoodSaveSchema.safeParse({ ...base, locale: 'it' }).success).toBe(false)
    expect(OwnFoodSaveSchema.safeParse({ ...base, locale: 'EN' }).success).toBe(false)
  })

  it('requires a non-empty entry key on update', () => {
    const data = { name: 'x', phe: 1, kcal: 1 }
    expect(OwnFoodUpdateSchema.safeParse({ entryKey: '-Nabc', data }).success).toBe(true)
    expect(OwnFoodUpdateSchema.safeParse({ entryKey: '', data }).success).toBe(false)
    expect(OwnFoodUpdateSchema.safeParse({ data }).success).toBe(false)
  })

  it('strips attempts to rewrite where a food came from', () => {
    const result = OwnFoodUpdateSchema.parse({
      entryKey: '-Nabc',
      data: {
        name: 'My shake',
        phe: 12,
        kcal: 90,
        source: 'manual',
        sourceId: null,
        materiallyEdited: false
      }
    })

    expect(result.data).not.toHaveProperty('source')
    expect(result.data).not.toHaveProperty('sourceId')
    expect(result.data).not.toHaveProperty('materiallyEdited')
  })

  it('accepts a corrected factor on update', () => {
    const result = OwnFoodUpdateSchema.parse({
      entryKey: '-Nabc',
      data: { name: 'Apple', phe: 54, kcal: 52, factor: 27, nutrients: { protein: 2 } }
    })

    expect(result.data.factor).toBe(27)
  })
})

describe('CommunityVoteSchema', () => {
  it('accepts exactly +1 and -1', () => {
    expect(CommunityVoteSchema.safeParse({ communityFoodKey: 'k', vote: 1 }).success).toBe(true)
    expect(CommunityVoteSchema.safeParse({ communityFoodKey: 'k', vote: -1 }).success).toBe(true)
  })

  // Votes feed a ServerValue.increment, so an out-of-range value would move the
  // score by an arbitrary amount and could hide a food outright.
  it('rejects any other vote weight', () => {
    for (const vote of [0, 2, -2, 100, 1.0001, '1', true, null]) {
      expect(CommunityVoteSchema.safeParse({ communityFoodKey: 'k', vote }).success).toBe(false)
    }
  })

  it('requires a community food key', () => {
    expect(CommunityVoteSchema.safeParse({ communityFoodKey: '', vote: 1 }).success).toBe(false)
  })
})

describe('CommunityFoodCommentSchema', () => {
  it('distinguishes a new comment from an edit by its optional comment id', () => {
    expect(
      CommunityFoodCommentSchema.safeParse({ communityFoodKey: 'food', comment: 'New' }).success
    ).toBe(true)
    expect(
      CommunityFoodCommentSchema.safeParse({
        communityFoodKey: 'food',
        commentId: 'comment',
        comment: 'Edited'
      }).success
    ).toBe(true)
  })

  it('requires the exact comment id for deletion', () => {
    expect(
      CommunityFoodCommentDeleteSchema.safeParse({
        communityFoodKey: 'food',
        commentId: 'comment'
      }).success
    ).toBe(true)
    expect(CommunityFoodCommentDeleteSchema.safeParse({ communityFoodKey: 'food' }).success).toBe(
      false
    )
  })
})

describe('diary day schemas', () => {
  it('accepts a valid day and rejects a malformed date', () => {
    expect(CreateDaySchema.safeParse({ date: '2026-07-26', phe: 300, kcal: 1800 }).success).toBe(
      true
    )
    expect(CreateDaySchema.safeParse({ date: '26.07.2026', phe: 300, kcal: 1800 }).success).toBe(
      false
    )
  })

  it('rejects negative day totals', () => {
    expect(CreateDaySchema.safeParse({ date: '2026-07-26', phe: -1, kcal: 0 }).success).toBe(false)
  })

  it('validates every entry of a synced log array', () => {
    const ok = UpdateDaySchema.safeParse({
      phe: 300,
      kcal: 1800,
      log: [validEntry, { ...validEntry, name: 'Bread' }]
    })
    expect(ok.success).toBe(true)

    const bad = UpdateDaySchema.safeParse({
      phe: 300,
      kcal: 1800,
      log: [validEntry, { ...validEntry, weight: 0 }]
    })
    expect(bad.success).toBe(false)
  })

  it('takes the incomplete flag as a real boolean only', () => {
    expect(UpdateDaySchema.safeParse({ phe: 0, kcal: 0, incomplete: true }).success).toBe(true)
    expect(UpdateDaySchema.safeParse({ phe: 0, kcal: 0, incomplete: 'yes' }).success).toBe(false)
  })

  it('addresses log entries by stable id with a legacy index fallback', () => {
    expect(DeleteFoodItemSchema.safeParse({ itemId: '-Nitem' }).success).toBe(true)
    expect(DeleteFoodItemSchema.safeParse({ logIndex: 0 }).success).toBe(true)
    expect(DeleteFoodItemSchema.safeParse({}).success).toBe(false)
    expect(DeleteFoodItemSchema.safeParse({ itemId: '' }).success).toBe(false)
    expect(DeleteFoodItemSchema.safeParse({ logIndex: -1 }).success).toBe(false)
    expect(DeleteFoodItemSchema.safeParse({ logIndex: 1.5 }).success).toBe(false)
    expect(DeleteFoodItemSchema.safeParse({ logIndex: '0' }).success).toBe(false)
    expect(UpdateFoodItemSchema.safeParse({ itemId: '-Nitem', entry: validEntry }).success).toBe(
      true
    )
    expect(UpdateFoodItemSchema.safeParse({ entry: validEntry }).success).toBe(false)
    expect(UpdateFoodItemSchema.safeParse({ logIndex: -1, entry: validEntry }).success).toBe(false)
  })

  it('requires an entry key when updating a lab value', () => {
    const data = { date: '2026-07-26', phe: 240 }
    expect(LabValueUpdateSchema.safeParse({ entryKey: 'k', data }).success).toBe(true)
    expect(LabValueUpdateSchema.safeParse({ entryKey: '', data }).success).toBe(false)
  })
})

describe('SettingsUpdateSchema', () => {
  it('accepts a full settings payload', () => {
    const result = SettingsUpdateSchema.safeParse({
      maxPhe: 300,
      maxKcal: 2000,
      bloodPheMin: 120,
      bloodPheMax: 360,
      bloodTyrMin: 20,
      bloodTyrMax: 100,
      labUnit: 'umoll',
      progressStyle: 'bars',
      preferredTool: 'barcode-scanner',
      license: null
    })
    expect(result.success).toBe(true)
  })

  it('allows clearing a limit with null', () => {
    expect(SettingsUpdateSchema.safeParse({ maxPhe: null, maxKcal: null }).success).toBe(true)
  })

  it('rejects negative limits', () => {
    expect(SettingsUpdateSchema.safeParse({ maxPhe: -1 }).success).toBe(false)
    expect(SettingsUpdateSchema.safeParse({ bloodPheMax: -1 }).success).toBe(false)
  })

  // The UI switches units and tools on these exact strings; an unknown value
  // would persist and leave the reader falling through to a wrong branch.
  it('restricts enum settings to known values', () => {
    expect(SettingsUpdateSchema.safeParse({ labUnit: 'mgdl' }).success).toBe(true)
    expect(SettingsUpdateSchema.safeParse({ labUnit: 'mg/dl' }).success).toBe(false)
    expect(SettingsUpdateSchema.safeParse({ progressStyle: 'circles' }).success).toBe(true)
    expect(SettingsUpdateSchema.safeParse({ progressStyle: 'rings' }).success).toBe(false)
    for (const tool of ['food-search', 'barcode-scanner', 'ai-calculator', 'phe-calculator']) {
      expect(SettingsUpdateSchema.safeParse({ preferredTool: tool }).success).toBe(true)
    }
    expect(SettingsUpdateSchema.safeParse({ preferredTool: 'diary' }).success).toBe(false)
  })
})

describe('consent and reset schemas', () => {
  it('takes consent flags as booleans only', () => {
    expect(ConsentSchema.safeParse({ healthDataConsent: true, emailConsent: false }).success).toBe(
      true
    )
    expect(ConsentSchema.safeParse({ healthDataConsent: 'true' }).success).toBe(false)
    expect(ConsentSchema.safeParse({ healthDataConsent: 1 }).success).toBe(false)
  })

  it('requires an explicit completed flag for getting started', () => {
    expect(GettingStartedSchema.safeParse({ completed: true }).success).toBe(true)
    expect(GettingStartedSchema.safeParse({}).success).toBe(false)
  })

  // Reset wipes a whole collection; the enum is what stops an arbitrary path.
  it('only allows the three resettable collections', () => {
    for (const target of ['diary', 'labValues', 'ownFood']) {
      expect(ResetSchema.safeParse(target).success).toBe(true)
    }
    for (const target of ['settings', 'all', '', '/', 'communityFoods']) {
      expect(ResetSchema.safeParse(target).success).toBe(false)
    }
  })
})
