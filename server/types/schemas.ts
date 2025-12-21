import { z } from 'zod'

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
  kcal: z.coerce.number().nonnegative('Kcal value must be non-negative')
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
  kcal: z.coerce.number().nonnegative('Kcal value must be non-negative')
})

// Diary save request schema (includes date and log entry)
export const DiarySaveSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD format
  log: z.array(DiaryEntrySchema).min(1)
})

// Diary update request schema (updates a specific log item in an entry)
export const DiaryUpdateSchema = z.object({
  entryKey: z.string().min(1, 'Entry key is required'),
  logIndex: z.number().int().nonnegative('Log index must be non-negative'),
  entry: DiaryEntrySchema
})

// Lab value update request schema
export const LabValueUpdateSchema = z.object({
  entryKey: z.string().min(1, 'Entry key is required'),
  data: LabValueSchema
})

// Own food update request schema
export const OwnFoodUpdateSchema = z.object({
  entryKey: z.string().min(1, 'Entry key is required'),
  data: OwnFoodSchema
})
