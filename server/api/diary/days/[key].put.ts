import { getAdminDatabase } from '../../../utils/firebase-admin'
import { UpdateDaySchema } from '../../../types/schemas'
import { defineAuthedHandler } from '../../../utils/handler'
import { validateBody } from '../../../utils/validation'

export default defineAuthedHandler(async ({ event, userId }) => {
  const key = getRouterParam(event, 'key')

  if (!key) {
    throw createError({
      statusCode: 400,
      message: 'Day entry key is required'
    })
  }

  const { date, phe, kcal, log, incomplete } = await validateBody(event, UpdateDaySchema)

  const db = getAdminDatabase()
  const diaryEntryRef = db.ref(`/${userId}/pheDiary/${key}`)
  const diaryEntrySnapshot = await diaryEntryRef.once('value')
  const existingDiaryEntry = diaryEntrySnapshot.val()

  if (!existingDiaryEntry) {
    throw createError({
      statusCode: 404,
      message: 'Diary entry not found'
    })
  }

  // Build update object with all fields that need to be updated
  // (update() merges, so an existing createdAt is preserved)
  const updateData: Record<string, unknown> = {
    updatedAt: Date.now()
  }

  // Include date if provided, but check for duplicates first
  if (date !== undefined) {
    // Only check for duplicates if the date is actually changing
    if (date !== existingDiaryEntry.date) {
      const duplicatesSnapshot = await db
        .ref(`/${userId}/pheDiary`)
        .orderByChild('date')
        .equalTo(date)
        .once('value')

      // Check if another entry with this date already exists (excluding current entry)
      if (duplicatesSnapshot.exists()) {
        const duplicates = duplicatesSnapshot.val()
        for (const entryKey of Object.keys(duplicates)) {
          if (entryKey !== key) {
            throw createError({
              statusCode: 409,
              message:
                'An entry with this date already exists. Please edit the existing entry instead.',
              data: { code: 'duplicate-date' }
            })
          }
        }
      }
    }
    updateData.date = date
  }

  // The totals are written only alongside the log they belong to, and a day
  // that carries items has its total summed here rather than taken from the
  // request — the same thing the food-item routes do, and the reason a day's
  // header cannot drift from the list beneath it. A day with no items is a
  // manual entry whose total is the data itself, so there the submitted value
  // stands.
  //
  // A request that omits the log is not about the totals at all — the diary's
  // "incomplete" toggle is the only one — so they are left untouched along with
  // the stored log. Writing back a total the client happens to be holding could
  // otherwise overwrite a day whose items it has not seen.
  if (log !== undefined) {
    const hasItems = log.length > 0
    updateData.log = log
    updateData.phe = hasItems ? log.reduce((sum, item) => sum + (item.phe || 0), 0) : phe
    updateData.kcal = hasItems ? log.reduce((sum, item) => sum + (item.kcal || 0), 0) : kcal
  }
  // If log is not provided, don't update log (preserve existing log structure)

  if (incomplete !== undefined) {
    // Store true explicitly; clear the flag when false to keep records lean
    updateData.incomplete = incomplete ? true : null
  }

  await diaryEntryRef.update(updateData)

  return { success: true, key: key, updated: true }
})
