import { verifyIdToken, getAdminDatabase } from '../../utils/firebase-admin'
import { z } from 'zod'

const SettingsUpdateSchema = z.object({
  maxPhe: z.coerce.number().nonnegative('Max Phe must be non-negative').nullable().optional(),
  maxKcal: z.coerce.number().nonnegative('Max Kcal must be non-negative').nullable().optional(),
  labUnit: z.enum(['mgdl', 'umoll'], {
    errorMap: () => ({ message: 'Lab unit must be mgdl or umoll' })
  }).optional(),
  license: z.string().nullable().optional()
})

export default defineEventHandler(async (event) => {
  try {
    const authHeader = getHeader(event, 'authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw createError({
        statusCode: 401,
        message: 'Missing or invalid authorization header'
      })
    }

    const token = authHeader.substring(7)
    const decodedToken = await verifyIdToken(token)
    const userId = decodedToken.uid

    const body = await readBody(event)
    const validation = SettingsUpdateSchema.safeParse(body)

    if (!validation.success) {
      const errorMessages = validation.error.issues
        .map((issue) => {
          const path = issue.path.join('.')
          return `${path ? `${path}: ` : ''}${issue.message}`
        })
        .join(', ')

      throw createError({
        statusCode: 400,
        message: `Validation failed: ${errorMessages}`,
        data: validation.error.issues
      })
    }

    const db = getAdminDatabase()
    const settingsRef = db.ref(`/${userId}/settings`)

    // Only update the fields that were provided
    const updateData: Record<string, unknown> = {}
    if (validation.data.maxPhe !== undefined) {
      updateData.maxPhe = validation.data.maxPhe || 0
    }
    if (validation.data.maxKcal !== undefined) {
      updateData.maxKcal = validation.data.maxKcal || 0
    }
    if (validation.data.labUnit !== undefined) {
      updateData.labUnit = validation.data.labUnit
    }
    if (validation.data.license !== undefined) {
      updateData.license = validation.data.license || ''
    }

    await settingsRef.update(updateData)

    return { success: true }
  } catch (error: unknown) {
    const firebaseError = error as { code?: string }
    if (
      firebaseError.code === 'auth/id-token-expired' ||
      firebaseError.code === 'auth/argument-error'
    ) {
      throw createError({
        statusCode: 401,
        message: 'Invalid or expired token'
      })
    }
    const httpError = error as { statusCode?: number }
    if (httpError.statusCode) {
      throw error
    }
    throw createError({
      statusCode: 500,
      message: 'Internal server error'
    })
  }
})

