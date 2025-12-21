import { verifyIdToken, getAdminDatabase } from '../../utils/firebase-admin'
import { z } from 'zod'
import { format } from 'date-fns'

const CreateDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  phe: z.coerce.number().nonnegative('Phe value must be non-negative'),
  kcal: z.coerce.number().nonnegative('Kcal value must be non-negative')
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
    const validation = CreateDaySchema.safeParse(body)

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

    // Check license-based limits (free users limited to 14 entries)
    const settingsRef = db.ref(`/${userId}/settings`)
    const settingsSnapshot = await settingsRef.once('value')
    const settings = settingsSnapshot.val() || {}

    const config = useRuntimeConfig()
    const licenseKey = settings.license
    const isPremium = licenseKey === config.pkutoolsLicenseKey

    const { date, phe, kcal } = validation.data

    // Check diary entry limit for free users
    const diaryRef = db.ref(`/${userId}/pheDiary`)
    const diarySnapshot = await diaryRef.once('value')
    const diaryData = diarySnapshot.val() || {}

    if (!isPremium) {
      const entryCount = diaryData ? Object.keys(diaryData).length : 0

      if (entryCount >= 14) {
        throw createError({
          statusCode: 403,
          message: 'Diary limit reached. Upgrade to premium for unlimited entries.'
        })
      }
    }

    // Always create a new day entry, even if a day with this date already exists
    // This is for the diet-report page where you can have multiple entries per date
    const newEntryRef = db.ref(`/${userId}/pheDiary`).push()
    await newEntryRef.set({
      date,
      phe,
      kcal,
      log: [] // Empty log array - this is a day entry, not a food item entry
    })

    return {
      success: true,
      key: newEntryRef.key
    }
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

