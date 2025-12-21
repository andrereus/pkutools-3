import { verifyIdToken, getAdminDatabase } from '../../utils/firebase-admin'
import { DiaryEntrySchema } from '../../types/schemas'

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
    const entryKey = body.entryKey
    const logItem = body.logItem

    if (!entryKey || typeof entryKey !== 'string') {
      throw createError({
        statusCode: 400,
        message: 'Entry key is required'
      })
    }

    // Validate the log item
    const validation = DiaryEntrySchema.safeParse(logItem)
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
    const diaryEntryRef = db.ref(`/${userId}/pheDiary/${entryKey}`)
    const diaryEntrySnapshot = await diaryEntryRef.once('value')
    const existingDiaryEntry = diaryEntrySnapshot.val()

    if (!existingDiaryEntry) {
      throw createError({
        statusCode: 404,
        message: 'Diary entry not found'
      })
    }

    const currentLog = existingDiaryEntry.log || []
    const updatedLog = [...currentLog, validation.data]

    // Calculate totals
    const totalPhe = updatedLog.reduce((sum: number, item) => sum + (item.phe || 0), 0)
    const totalKcal = updatedLog.reduce((sum: number, item) => sum + (item.kcal || 0), 0)

    await diaryEntryRef.update({
      log: updatedLog,
      phe: totalPhe,
      kcal: totalKcal
    })

    return {
      success: true,
      key: entryKey,
      updated: true
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

