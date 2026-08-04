import { getAdminDatabase } from '../../../utils/firebase-admin'
import { UpdateDaySchema } from '../../../types/schemas'
import { defineAuthedHandler } from '../../../utils/handler'
import { validateBody } from '../../../utils/validation'
import { applyDiaryEditProvenance } from '../../../utils/food-provenance'
import { storedNumberOrZero } from '../../../utils/numeric'

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
    const existingLog = (existingDiaryEntry.log || []) as Array<Record<string, unknown>>
    const unmatchedExisting = new Set(existingLog)
    const incomingItemIdCounts = new Map<string, number>()
    for (const item of log) {
      if (item.itemId) {
        incomingItemIdCounts.set(item.itemId, (incomingItemIdCounts.get(item.itemId) || 0) + 1)
      }
    }

    if ([...incomingItemIdCounts.values()].some((count) => count > 1)) {
      throw createError({
        statusCode: 409,
        message: 'Diary food item id is not unique',
        data: { code: 'duplicate-diary-item-id' }
      })
    }

    const identityConflict = (message: string, code: string): never => {
      throw createError({ statusCode: 409, message, data: { code } })
    }
    const takeByItemId = (itemId: string) => {
      const matches = [...unmatchedExisting].filter((item) => item.itemId === itemId)
      if (matches.length > 1) {
        return identityConflict('Diary food item id is not unique', 'duplicate-diary-item-id')
      }
      const match = matches[0]
      if (!match) {
        return identityConflict(
          'Diary food item no longer matches the stored day',
          'stale-diary-log'
        )
      }
      unmatchedExisting.delete(match)
      return match
    }
    const takeLegacyByCreatedAt = (createdAt: number) => {
      const legacyMatches = [...unmatchedExisting].filter(
        (item) => !item.itemId && item.createdAt === createdAt
      )
      // A timestamp is only an identity fallback for an entry that has never
      // received a stable id. If an id-bearing entry arrives without its id,
      // accepting the weaker claim could overwrite a newer or different item.
      if (
        legacyMatches.length === 0 &&
        existingLog.some((item) => item.itemId && item.createdAt === createdAt)
      ) {
        return identityConflict('Diary food item identity is stale', 'stale-diary-log')
      }
      const match = legacyMatches[0]
      if (match) unmatchedExisting.delete(match)
      return match
    }
    const newItemId = () => db.ref(`/${userId}/pheDiary/${key}/logItemIds`).push().key!
    const now = Date.now()

    const updatedLog = log.map((item, index) => {
      const indexedExisting = existingLog[index]
      const existingItem = item.itemId
        ? takeByItemId(item.itemId)
        : item.createdAt != null
          ? takeLegacyByCreatedAt(item.createdAt)
          : // The oldest entries have neither field. Index is the last available
            // fallback, and only when the candidate is equally identity-less.
            // A Diet Report addition always has a creation timestamp, so a
            // delete-plus-add cannot inherit the deleted item's provenance.
            existingLog.length === log.length &&
              indexedExisting?.itemId == null &&
              indexedExisting?.createdAt == null &&
              unmatchedExisting.has(indexedExisting)
            ? indexedExisting
            : undefined

      if (existingItem) {
        unmatchedExisting.delete(existingItem)
        const updatedItem = applyDiaryEditProvenance(existingItem, item)
        updatedItem.itemId = existingItem.itemId || newItemId()
        // createdAt is immutable too. Legacy entries remain without one.
        if (existingItem.createdAt != null) updatedItem.createdAt = existingItem.createdAt
        else delete updatedItem.createdAt
        return updatedItem
      }

      // A new item cannot claim another item's identity. Assign one here so
      // additions made inside Diet Report receive the same server-owned id as
      // additions made through the single-item endpoint.
      const { itemId: _ignoredItemId, ...newItem } = item
      return {
        ...newItem,
        itemId: newItemId(),
        createdAt: item.createdAt ?? now,
        updatedAt: item.updatedAt ?? now
      }
    })
    const hasItems = updatedLog.length > 0
    updateData.log = updatedLog
    updateData.phe = hasItems
      ? updatedLog.reduce((sum, item) => sum + storedNumberOrZero(item.phe), 0)
      : phe
    updateData.kcal = hasItems
      ? updatedLog.reduce((sum, item) => sum + storedNumberOrZero(item.kcal), 0)
      : kcal
  }
  // If log is not provided, don't update log (preserve existing log structure)

  if (incomplete !== undefined) {
    // Store true explicitly; clear the flag when false to keep records lean
    updateData.incomplete = incomplete ? true : null
  }

  await diaryEntryRef.update(updateData)

  return { success: true, key: key, updated: true }
})
