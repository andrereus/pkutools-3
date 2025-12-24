import { verifyIdToken, getAdminDatabase } from '../../utils/firebase-admin'
import { DiaryEntrySchema } from '../../types/schemas'
import { format } from 'date-fns'

export default defineEventHandler(async (event) => {
  try {
    // Get auth token from header
    const authHeader = getHeader(event, 'authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw createError({
        statusCode: 401,
        message: 'Missing or invalid authorization header'
      })
    }

    const token = authHeader.substring(7)

    // Verify token and get user ID
    let decodedToken
    try {
      decodedToken = await verifyIdToken(token)
    } catch (verifyError) {
      const error = verifyError as { code?: string; message?: string }
      console.error('Token verification failed:', error.code, error.message)
      throw createError({
        statusCode: 401,
        message: 'Invalid or expired token'
      })
    }
    const userId = decodedToken.uid

    // Get request body
    const body = await readBody(event)

    // Validate input - expect a single log entry with optional date
    const validation = DiaryEntrySchema.safeParse(body)

    if (!validation.success) {
      // Format validation errors for better user feedback
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

    // Determine date
    const date = body.date || format(new Date(), 'yyyy-MM-dd')

    const diaryRef = db.ref(`/${userId}/pheDiary`)
    const diarySnapshot = await diaryRef.once('value')
    const diaryData = diarySnapshot.val() || {}

    // Find existing entry for this date
    // This API is for adding food items to days, so we merge with existing day if date matches
    interface DiaryEntry {
      date: string
      log?: Array<unknown>
    }
    let existingEntryKey: string | null = null
    for (const [key, entry] of Object.entries(diaryData)) {
      if ((entry as DiaryEntry).date === date) {
        existingEntryKey = key
        break
      }
    }

    // Check diary entry limit for free users (only when creating new date entry)
    if (!isPremium && !existingEntryKey) {
      const entryCount = diaryData ? Object.keys(diaryData).length : 0

      if (entryCount >= 14) {
        throw createError({
          statusCode: 403,
          message: 'Diary limit reached. Upgrade to premium for unlimited entries.'
        })
      }
    }

    if (existingEntryKey) {
      // Update existing entry - add new log item
      interface DiaryEntry {
        date: string
        log: Array<{ phe: number; kcal: number }>
        phe: number
        kcal: number
      }
      const existingEntry = diaryData[existingEntryKey] as DiaryEntry
      const updatedLog = [...(existingEntry.log || []), validation.data]

      // Calculate totals
      const totalPhe = updatedLog.reduce((sum: number, item) => sum + (item.phe || 0), 0)
      const totalKcal = updatedLog.reduce((sum: number, item) => sum + (item.kcal || 0), 0)

      await db.ref(`/${userId}/pheDiary/${existingEntryKey}`).update({
        log: updatedLog,
        phe: totalPhe,
        kcal: totalKcal
      })

      return {
        success: true,
        key: existingEntryKey,
        updated: true
      }
    } else {
      // Create new entry
      const logEntry = validation.data
      const totalPhe = logEntry.phe || 0
      const totalKcal = logEntry.kcal || 0

      const newEntryRef = db.ref(`/${userId}/pheDiary`).push()
      await newEntryRef.set({
        date,
        phe: totalPhe,
        kcal: totalKcal,
        log: [logEntry]
      })

      return {
        success: true,
        key: newEntryRef.key,
        updated: false
      }
    }
  } catch (error: unknown) {
    // Handle Firebase auth errors
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

    // Re-throw createError instances
    const httpError = error as { statusCode?: number }
    if (httpError.statusCode) {
      throw error
    }

    // Handle unexpected errors
    throw createError({
      statusCode: 500,
      message: 'Internal server error'
    })
  }
})

