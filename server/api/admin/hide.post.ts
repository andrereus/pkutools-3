import { getAdminDatabase } from '../../utils/firebase-admin'
import { AdminHideSchema } from '../../types/schemas'
import { defineAdminHandler } from '../../utils/handler'
import { validateBody } from '../../utils/validation'
import { threadPaths } from '../../utils/community-thread'

// Hides a food or a post, or shows it again. Hidden content stays where it is,
// seen only by its owner and by admins, until it is shown again or deleted.
// Comments are not hidden, only deleted.
export default defineAdminHandler(async ({ event }) => {
  const { target, key, hidden } = await validateBody(event, AdminHideSchema)
  const db = getAdminDatabase()
  const { parent } = threadPaths(target, key)
  const record = (await db.ref(parent).once('value')).val() as Record<string, unknown> | null
  if (!record) throw createError({ statusCode: 404, message: 'Not found' })

  if (Boolean(record.hiddenAt) !== hidden) {
    await db.ref(parent).update({ hiddenAt: hidden ? Date.now() : null })
  }
  return { success: true }
})
