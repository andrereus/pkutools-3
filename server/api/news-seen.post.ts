import { getAdminDatabase } from '../utils/firebase-admin'
import { NewsSeenSchema } from '../types/schemas'
import { defineAuthedHandler } from '../utils/handler'
import { validateBody } from '../utils/validation'

// What the account has seen in News, so the blue dots and the bell agree on
// every device. Both values only ever move forward.
export default defineAuthedHandler(async ({ event, userId }) => {
  const { lastReadAt, lastSeenRevision } = await validateBody(event, NewsSeenSchema)
  const seenRef = getAdminDatabase().ref(`${userId}/newsSeen`)
  const stored = ((await seenRef.once('value')).val() ?? {}) as Record<string, unknown>

  const isLater = (next: number | undefined, current: unknown): next is number =>
    next !== undefined && (typeof current !== 'number' || next > current)
  const patch: Record<string, number> = {}
  if (isLater(lastReadAt, stored.lastReadAt)) patch.lastReadAt = lastReadAt
  if (isLater(lastSeenRevision, stored.lastSeenRevision)) {
    patch.lastSeenRevision = lastSeenRevision
  }

  if (Object.keys(patch).length > 0) await seenRef.update(patch)
  return { success: true }
})
