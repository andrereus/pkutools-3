import { z } from 'zod'

// ============================================================================
// Base Entity Schemas
// ============================================================================

// Numeric nutrition, measurement, weight and target fields go through here
// rather than through Zod's coercing number, which runs Number() over whatever
// it is given: `true` becomes 1, and `[]`, `''` and `null` all become 0. On a
// Phe or kcal field that turns a malformed request into a silent,
// plausible-looking value — a false 0 being the error this app guards hardest
// against elsewhere (the BLS import drops foods over it). Rejecting the wrong
// shape outright makes it a 400 instead.
//
// Numeric strings are still accepted: legacy records and form fields hold
// values like "150", and the endpoints have always taken them.
const numeric = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() !== '' ? Number(value) : value),
    schema
  )

// Server-owned timestamps (ms epoch, matching communityFoods). Accepted in
// request schemas only so round trips (log sync, undo-restore) don't strip
// them; endpoints decide whether to honor or override the client value.
// Optional because legacy records were written without them.
const timestampFields = {
  createdAt: z.number().int().nonnegative().optional(),
  updatedAt: z.number().int().nonnegative().optional()
}

// Common nutrients per 100 g, kept at the precision the source publishes them.
// Every field is optional because sources carry different subsets: BLS has all
// of them, a scanned product often only protein. Consumed amounts are never
// stored — they follow from `weight`, so there is nothing to keep in sync when
// the weight is edited.
const NutrientsSchema = z.object({
  protein: numeric(z.number().nonnegative('Protein must be non-negative').nullable().optional()),
  fat: numeric(z.number().nonnegative('Fat must be non-negative').nullable().optional()),
  carbs: numeric(z.number().nonnegative('Carbs must be non-negative').nullable().optional()),
  sugar: numeric(z.number().nonnegative('Sugar must be non-negative').nullable().optional()),
  fiber: numeric(z.number().nonnegative('Fiber must be non-negative').nullable().optional()),
  salt: numeric(z.number().nonnegative('Salt must be non-negative').nullable().optional())
})

// Where a food's values originally came from, kept whatever the entry passes
// through afterwards. This is what decides whether an entry may be
// shared with the community: 'manual', 'ai-label' and 'barcode' are the user's
// own calculation, while the food-search origins are already searchable for
// everyone and 'ai-estimate' is a guess, so neither is reshared. The rule lives
// in utils/community-food.ts (SHAREABLE_FOOD_SOURCES), mirrored client-side.
//
// 'own-food' and 'community' are not value origins — a food picked from either
// list has values that came from somewhere else, which is what `addedFrom`
// below is for. They stay in the enum because diary entries written before that
// split carry them here, and every edit revalidates the whole entry.
export const FoodSourceSchema = z.enum([
  'bls',
  'usda',
  'own-food',
  'community',
  'barcode',
  'ai-estimate',
  'ai-label',
  'manual'
])

// Which collection a diary entry was taken from, when that is not where its
// values came from. Kept apart from `source` so picking a food out of a list
// never overwrites what the numbers actually came from: a scanned product saved
// to Own Food and logged from there a week later is still `source: 'barcode'`
// with its barcode, and `addedFrom: 'own-food'` on top. Null for an entry a
// tool wrote directly, where `source` already says how it was added.
export const AddedFromSchema = z.enum(['own-food', 'community'])

// Optional provenance and conversion metadata; legacy records may omit it.
const provenanceFields = {
  nutrients: NutrientsSchema.nullable().optional(),
  // mg Phe per g protein
  factor: numeric(
    z
      .number()
      .positive('Factor must be positive')
      .max(100, 'Factor is too large')
      .nullable()
      .optional()
  ),
  source: FoodSourceSchema.nullable().optional(),
  // Identifier of the food within `source` — a barcode, a BLS id, a USDA id.
  // Absent where the source has no stable id of its own.
  sourceId: z.string().max(64, 'Source id is too long').nullable().optional(),
  materiallyEdited: z.boolean().optional()
}

const DiaryItemIdSchema = z
  .string()
  .min(1, 'Diary item id is required')
  .max(64, 'Diary item id is too long')

export const DiaryEntrySchema = z.object({
  // Stable identity within a day's log. New entries receive a Firebase push id
  // server-side; optional so existing timestamp-only entries remain valid and
  // can be upgraded on their next edit.
  itemId: DiaryItemIdSchema.optional(),
  name: z.string().min(1, 'Food name is required').max(200, 'Food name is too long'),
  emoji: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  pheReference: numeric(
    z.number().nonnegative('Phe reference must be non-negative').nullable().optional()
  ),
  kcalReference: numeric(
    z.number().nonnegative('Kcal reference must be non-negative').nullable().optional()
  ),
  weight: numeric(
    z.number().positive('Weight must be a positive number').max(10000, 'Weight is too large')
  ),
  phe: numeric(z.number().nonnegative('Phe value must be non-negative')),
  kcal: numeric(z.number().nonnegative('Kcal value must be non-negative')),
  note: z.string().max(500, 'Note is too long').nullable().optional(),
  communityFoodKey: z.string().nullable().optional(), // Optional: tracks which community food was used (stored in diary entry)
  ...provenanceFields,
  // Only diary entries are added from somewhere: an own food and a community
  // food are the collections, not entries in one
  addedFrom: AddedFromSchema.nullable().optional(),
  ...timestampFields
})

export const LabValueSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
    phe: numeric(z.number().positive('Phe value must be positive').nullable().optional()),
    tyrosine: numeric(z.number().positive('Tyrosine value must be positive').nullable().optional()),
    ...timestampFields
  })
  // Loose `!= null` so an omitted (undefined) field counts as "not provided"
  // too — otherwise a request with neither key passes (undefined !== null).
  .refine((data) => data.phe != null || data.tyrosine != null, {
    message: 'Either Phe or Tyrosine must be provided',
    path: ['phe'] // Point to phe field for error
  })

export const OwnFoodSchema = z.object({
  name: z.string().min(1, 'Food name is required').max(200, 'Food name is too long'),
  icon: z.string().nullable().optional(),
  emoji: z.string().nullable().optional(),
  phe: numeric(z.number().nonnegative('Phe value must be non-negative')),
  kcal: numeric(z.number().nonnegative('Kcal value must be non-negative')),
  note: z.string().max(500, 'Note is too long').nullable().optional(),
  shared: z.boolean().default(false),
  ...provenanceFields,
  ...timestampFields
})

// Own food save request schema (includes locale)
export const OwnFoodSaveSchema = OwnFoodSchema.extend({
  locale: z.enum(['en', 'de', 'es', 'fr']).optional() // Optional locale from frontend
})

// ============================================================================
// Community Food Schemas
// ============================================================================

// Community records are assembled server-side from validated input and trusted
// metadata. They are not accepted directly at a request boundary, so no
// separate Zod record schema is needed here.

const firebaseKeySchema = (label: string) =>
  z
    .string()
    .min(1, `${label} is required`)
    .max(128, `${label} is too long`)
    .refine(
      (key) => !['.', '#', '$', '[', ']', '/'].some((character) => key.includes(character)),
      `${label} is invalid`
    )

const CommunityFoodKeySchema = firebaseKeySchema('Community food key')
const CommunityFoodCommentIdSchema = firebaseKeySchema('Comment id')

// Vote schema for community foods
export const CommunityVoteSchema = z.object({
  communityFoodKey: CommunityFoodKeySchema,
  vote: z.union([z.literal(1), z.literal(-1)])
})

// Comments form a flat chronological conversation. Passing an id edits one
// existing comment; omitting it appends a new one.
export const CommunityFoodCommentSchema = z.object({
  communityFoodKey: CommunityFoodKeySchema,
  commentId: CommunityFoodCommentIdSchema.optional(),
  comment: z.string().trim().min(1, 'Comment is required').max(300, 'Comment is too long')
})

export const CommunityFoodCommentDeleteSchema = z.object({
  communityFoodKey: CommunityFoodKeySchema,
  commentId: CommunityFoodCommentIdSchema
})

// ============================================================================
// Diary Request Schemas
// ============================================================================

export const CreateDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  phe: numeric(z.number().nonnegative('Phe value must be non-negative')),
  kcal: numeric(z.number().nonnegative('Kcal value must be non-negative')),
  ...timestampFields
})

export const UpdateDaySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format')
    .optional(), // Optional date to allow date changes
  phe: numeric(z.number().nonnegative('Phe value must be non-negative')),
  kcal: numeric(z.number().nonnegative('Kcal value must be non-negative')),
  log: z.array(DiaryEntrySchema).optional(), // Optional log array to sync deletions - validate structure
  incomplete: z.boolean().optional() // When true, the day is flagged as incomplete (not every food was logged) and hidden from chart + stats
})

const diaryItemLocatorFields = {
  itemId: DiaryItemIdSchema.optional(),
  // Kept for clients and records from before stable item ids existed.
  logIndex: z.number().int().nonnegative('Log index must be non-negative').optional()
}
const hasDiaryItemLocator = (data: { itemId?: string; logIndex?: number }) =>
  data.itemId !== undefined || data.logIndex !== undefined

export const UpdateFoodItemSchema = z
  .object({
    ...diaryItemLocatorFields,
    entry: DiaryEntrySchema
  })
  .refine(hasDiaryItemLocator, {
    message: 'Diary item id or legacy log index is required',
    path: ['itemId']
  })

export const DeleteFoodItemSchema = z.object(diaryItemLocatorFields).refine(hasDiaryItemLocator, {
  message: 'Diary item id or legacy log index is required',
  path: ['itemId']
})

// ============================================================================
// Lab Values Request Schemas
// ============================================================================

export const LabValueUpdateSchema = z.object({
  entryKey: z.string().min(1, 'Entry key is required'),
  data: LabValueSchema
})

// ============================================================================
// Own Food Request Schemas
// ============================================================================

// Source fields stay immutable; nutrients and factor remain editable.
const OwnFoodEditableSchema = OwnFoodSchema.omit({
  source: true,
  sourceId: true,
  materiallyEdited: true,
  createdAt: true,
  updatedAt: true
})

export const OwnFoodUpdateSchema = z.object({
  entryKey: z.string().min(1, 'Entry key is required'),
  locale: z.enum(['en', 'de', 'es', 'fr']).optional(), // Optional locale from frontend
  data: OwnFoodEditableSchema
})

// ============================================================================
// Settings Request Schemas
// ============================================================================

export const SettingsUpdateSchema = z.object({
  maxPhe: numeric(z.number().nonnegative('Max Phe must be non-negative').nullable().optional()),
  maxKcal: numeric(z.number().nonnegative('Max Kcal must be non-negative').nullable().optional()),
  bloodPheMin: numeric(
    z.number().nonnegative('Min blood Phe must be non-negative').nullable().optional()
  ),
  bloodPheMax: numeric(
    z.number().nonnegative('Max blood Phe must be non-negative').nullable().optional()
  ),
  bloodTyrMin: numeric(
    z.number().nonnegative('Min tyrosine must be non-negative').nullable().optional()
  ),
  bloodTyrMax: numeric(
    z.number().nonnegative('Max tyrosine must be non-negative').nullable().optional()
  ),
  labUnit: z.enum(['mgdl', 'umoll']).optional(),
  progressStyle: z.enum(['bars', 'circles']).optional(),
  preferredTool: z
    .enum(['food-search', 'barcode-scanner', 'ai-calculator', 'phe-calculator'])
    .optional(),
  license: z.string().nullable().optional()
})

export const ConsentSchema = z.object({
  healthDataConsent: z.boolean().optional(),
  emailConsent: z.boolean().optional()
})

export const GettingStartedSchema = z.object({
  completed: z.boolean()
})

export const ResetSchema = z.enum(['diary', 'labValues', 'ownFood'])
