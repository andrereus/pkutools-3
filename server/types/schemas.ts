import { z } from 'zod'

// ============================================================================
// Base Entity Schemas
// ============================================================================

// Diary entry schema
export const DiaryEntrySchema = z.object({
  name: z.string().min(1, 'Food name is required').max(200, 'Food name is too long'),
  emoji: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  pheReference: z.coerce
    .number()
    .nonnegative('Phe reference must be non-negative')
    .nullable()
    .optional(),
  kcalReference: z.coerce
    .number()
    .nonnegative('Kcal reference must be non-negative')
    .nullable()
    .optional(),
  weight: z.coerce
    .number()
    .positive('Weight must be a positive number')
    .max(10000, 'Weight is too large'),
  phe: z.coerce.number().nonnegative('Phe value must be non-negative'),
  kcal: z.coerce.number().nonnegative('Kcal value must be non-negative'),
  note: z.string().max(500, 'Note is too long').nullable().optional(),
  communityFoodKey: z.string().nullable().optional() // Optional: tracks which community food was used (stored in diary entry)
})

// Lab value schema
export const LabValueSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
    phe: z.coerce.number().positive('Phe value must be positive').nullable().optional(),
    tyrosine: z.coerce.number().positive('Tyrosine value must be positive').nullable().optional()
  })
  .refine((data) => data.phe !== null || data.tyrosine !== null, {
    message: 'Either Phe or Tyrosine must be provided',
    path: ['phe'] // Point to phe field for error
  })

// Own food schema
export const OwnFoodSchema = z.object({
  name: z.string().min(1, 'Food name is required').max(200, 'Food name is too long'),
  icon: z.string().nullable().optional(),
  phe: z.coerce.number().nonnegative('Phe value must be non-negative'),
  kcal: z.coerce.number().nonnegative('Kcal value must be non-negative'),
  note: z.string().max(500, 'Note is too long').nullable().optional(),
  shared: z.boolean().default(false)
})

// Own food save request schema (includes locale)
export const OwnFoodSaveSchema = OwnFoodSchema.extend({
  locale: z.enum(['en', 'de', 'es', 'fr']).optional() // Optional locale from frontend
})

// ============================================================================
// Community Food Schemas
// ============================================================================

// Community food schema (for validation when creating/updating)
// Note: hidden status is computed from score (score < -3), not stored
export const CommunityFoodSchema = z.object({
  name: z.string().min(1).max(200),
  icon: z.string().nullable().optional(),
  phe: z.coerce.number().nonnegative(),
  kcal: z.coerce.number().nonnegative(),
  note: z.string().max(500).nullable().optional(),
  language: z.enum(['en', 'de', 'es', 'fr']),
  contributorId: z.string().min(1),
  ownFoodKey: z.string().min(1),
  createdAt: z.number(),
  updatedAt: z.number().optional(), // Last update by contributor; missing on legacy records
  likes: z.number().default(0),
  dislikes: z.number().default(0),
  score: z.number().default(0),
  usageCount: z.number().default(0)
})

// Vote schema for community foods
export const CommunityVoteSchema = z.object({
  communityFoodKey: z.string().min(1, 'Community food key is required'),
  vote: z.union([z.literal(1), z.literal(-1)])
})

// ============================================================================
// Diary Request Schemas
// ============================================================================

// Create diary day request schema
export const CreateDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  phe: z.coerce.number().nonnegative('Phe value must be non-negative'),
  kcal: z.coerce.number().nonnegative('Kcal value must be non-negative')
})

// Update diary day request schema
export const UpdateDaySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format')
    .optional(), // Optional date to allow date changes
  phe: z.coerce.number().nonnegative('Phe value must be non-negative'),
  kcal: z.coerce.number().nonnegative('Kcal value must be non-negative'),
  log: z.array(DiaryEntrySchema).optional() // Optional log array to sync deletions - validate structure
})

// Update food item in diary request schema
export const UpdateFoodItemSchema = z.object({
  logIndex: z.number().int().nonnegative('Log index must be non-negative'),
  entry: DiaryEntrySchema
})

// Delete food item from diary request schema
export const DeleteFoodItemSchema = z.object({
  logIndex: z.number().int().nonnegative('Valid log index is required')
})

// ============================================================================
// Lab Values Request Schemas
// ============================================================================

// Update lab value request schema
export const LabValueUpdateSchema = z.object({
  entryKey: z.string().min(1, 'Entry key is required'),
  data: LabValueSchema
})

// ============================================================================
// Own Food Request Schemas
// ============================================================================

// Update own food request schema
export const OwnFoodUpdateSchema = z.object({
  entryKey: z.string().min(1, 'Entry key is required'),
  locale: z.enum(['en', 'de', 'es', 'fr']).optional(), // Optional locale from frontend
  data: OwnFoodSchema
})

// ============================================================================
// Settings Request Schemas
// ============================================================================

// Update settings request schema
export const SettingsUpdateSchema = z.object({
  maxPhe: z.coerce.number().nonnegative('Max Phe must be non-negative').nullable().optional(),
  maxKcal: z.coerce.number().nonnegative('Max Kcal must be non-negative').nullable().optional(),
  labUnit: z.enum(['mgdl', 'umoll']).optional(),
  license: z.string().nullable().optional()
})

// Update consent request schema
export const ConsentSchema = z.object({
  healthDataConsent: z.boolean().optional(),
  emailConsent: z.boolean().optional()
})

// Update getting started request schema
export const GettingStartedSchema = z.object({
  completed: z.boolean()
})

// Reset data request schema
export const ResetSchema = z.enum(['diary', 'labValues', 'ownFood'])
