import { ServerValue } from 'firebase-admin/database'
import { getAdminDatabase } from '../../utils/firebase-admin'
import { AdminHideSchema } from '../../types/schemas'
import { defineAdminHandler } from '../../utils/handler'
import { validateBody } from '../../utils/validation'
import { queueThreadActivity, threadOwner, threadPaths } from '../../utils/community-thread'

// Hides a food, a post or one comment, or shows it again. Hidden content stays
// where it is, seen only by its owner and by admins, until it is shown again
// or deleted.
export default defineAdminHandler(async ({ event }) => {
  const { target, key, commentId, hidden } = await validateBody(event, AdminHideSchema)
  const db = getAdminDatabase()
  const paths = threadPaths(target, key)
  const hiddenAt = hidden ? Date.now() : null
  const notFound = () => createError({ statusCode: 404, message: 'Not found' })

  if (!commentId) {
    const record = (await db.ref(paths.parent).once('value')).val() as Record<
      string,
      unknown
    > | null
    if (!record) throw notFound()
    if (Boolean(record.hiddenAt) !== hidden) await db.ref(paths.parent).update({ hiddenAt })
    return { success: true }
  }

  const [threadSnapshot, parentSnapshot] = await Promise.all([
    db.ref(paths.thread).once('value'),
    db.ref(paths.parent).once('value')
  ])
  const thread = (threadSnapshot.val() ?? {}) as Record<string, Record<string, unknown> | null>
  const comment = thread[commentId]
  if (!comment || comment.type === 'content-update') throw notFound()
  if (Boolean(comment.hiddenAt) === hidden) return { success: true }

  // A hidden comment leaves the comment count and the activity that notifies
  // people, and joins the count of hidden comments, which lets the admin page
  // find it.
  const writes: Record<string, unknown> = { [`${paths.thread}/${commentId}/hiddenAt`]: hiddenAt }
  const parent = parentSnapshot.val() as Record<string, unknown> | null
  if (parent) {
    writes[`${paths.parent}/commentCount`] = ServerValue.increment(hidden ? -1 : 1)
    writes[`${paths.parent}/hiddenCommentCount`] = ServerValue.increment(hidden ? 1 : -1)
    queueThreadActivity(
      writes,
      target,
      key,
      { ...thread, [commentId]: { ...comment, hiddenAt } },
      threadOwner(target, parent)
    )
  }
  await db.ref().update(writes)
  return { success: true }
})
