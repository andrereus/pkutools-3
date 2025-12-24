import { verifyIdToken, getAdminDatabase } from '../../utils/firebase-admin'
import { DiaryUpdateSchema } from '../../types/schemas'

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

    // Validate input
    const validation = DiaryUpdateSchema.safeParse(body)

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

    const { entryKey, logIndex, entry } = validation.data

    const db = getAdminDatabase()
    const diaryRef = db.ref(`/${userId}/pheDiary/${entryKey}`)
    const diarySnapshot = await diaryRef.once('value')
    const diaryEntry = diarySnapshot.val()

    if (!diaryEntry) {
      throw createError({
        statusCode: 404,
        message: 'Diary entry not found'
      })
    }

    // Validate log index
    const log = diaryEntry.log || []
    if (logIndex >= log.length) {
      throw createError({
        statusCode: 400,
        message: 'Log index out of range'
      })
    }

    // Update the log item
    const updatedLog = [...log]
    updatedLog[logIndex] = entry

    // Calculate totals
    const totalPhe = updatedLog.reduce((sum: number, item) => sum + (item.phe || 0), 0)
    const totalKcal = updatedLog.reduce((sum: number, item) => sum + (item.kcal || 0), 0)

    // Update the entry
    await diaryRef.update({
      log: updatedLog,
      phe: totalPhe,
      kcal: totalKcal
    })

    return {
      success: true,
      key: entryKey
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

