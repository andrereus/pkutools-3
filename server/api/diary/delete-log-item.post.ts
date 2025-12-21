import { verifyIdToken, getAdminDatabase } from '../../utils/firebase-admin'

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
    const logIndex = body.logIndex

    if (!entryKey || typeof entryKey !== 'string') {
      throw createError({
        statusCode: 400,
        message: 'Entry key is required'
      })
    }

    if (typeof logIndex !== 'number' || logIndex < 0) {
      throw createError({
        statusCode: 400,
        message: 'Valid log index is required'
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
    if (logIndex >= currentLog.length) {
      throw createError({
        statusCode: 400,
        message: 'Invalid log item index'
      })
    }

    // Remove the log item
    currentLog.splice(logIndex, 1)

    // Recalculate totals
    const totalPhe = currentLog.reduce((sum: number, item: any) => sum + (item.phe || 0), 0)
    const totalKcal = currentLog.reduce((sum: number, item: any) => sum + (item.kcal || 0), 0)

    await diaryEntryRef.update({
      log: currentLog,
      phe: totalPhe,
      kcal: totalKcal
    })

    return { success: true, key: entryKey, deletedLogIndex: logIndex }
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

