import { getAdminDatabase } from '../../utils/firebase-admin'
import { LabValueUpdateSchema } from '../../types/schemas'
import { defineAuthedHandler } from '../../utils/handler'
import { validateBody } from '../../utils/validation'

export default defineAuthedHandler(async ({ event, userId }) => {
  const { entryKey, data } = await validateBody(event, LabValueUpdateSchema)

  const db = getAdminDatabase()
  const labValueRef = db.ref(`/${userId}/labValues/${entryKey}`)
  const labValueSnapshot = await labValueRef.once('value')
  const labValue = labValueSnapshot.val()

  if (!labValue) {
    throw createError({
      statusCode: 404,
      message: 'Lab value entry not found'
    })
  }

  // Check for duplicate date if date is being changed
  if (data.date && data.date !== labValue.date) {
    const duplicatesSnapshot = await db
      .ref(`/${userId}/labValues`)
      .orderByChild('date')
      .equalTo(data.date)
      .once('value')

    // Check if another entry with this date already exists (excluding current entry)
    if (duplicatesSnapshot.exists()) {
      const duplicates = duplicatesSnapshot.val()
      for (const key of Object.keys(duplicates)) {
        if (key !== entryKey) {
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

  // Update the entry; the stored createdAt wins over anything the client
  // sent, and update() merges, so a legacy entry stays without one.
  await labValueRef.update({
    ...data,
    ...(labValue.createdAt != null && { createdAt: labValue.createdAt }),
    updatedAt: Date.now()
  })

  return {
    success: true,
    key: entryKey
  }
})
