import { getAdminDatabase } from './firebase-admin'
import { REMOVED_CONTENT_RETENTION_MS } from '../../shared/utils/moderation'

// Content an admin removes is moved to `removedContent`, which only admins can
// read, so it leaves the community but can be put back. Each entry keeps the
// record as it was, and for a post or food also its comment thread.

export interface RemovedEntry {
  type: 'post' | 'food' | 'comment'
  /** The key it had where it lived. */
  key: string
  /** For a comment: the kind of thread and the key of its post or food. */
  target?: 'food' | 'post'
  parentKey?: string
  /** For a comment: what it was written on, for the admin page. */
  parentTitle?: string | null
  authorId: string | null
  language: string | null
  record: Record<string, unknown>
  thread?: Record<string, unknown> | null
  /** For a food: whether the contributor's own food was unshared with it. */
  unsharedOwnFood?: boolean
  removedAt: number
  removedBy: string
}

export const isDatabaseKey = (value: unknown): value is string =>
  typeof value === 'string' && value !== '' && !/[.#$[\]/]/.test(value)

export const stringOrNull = (value: unknown): string | null =>
  typeof value === 'string' && value !== '' ? value : null

export const isRemovalExpired = (entry: { removedAt?: unknown }, now = Date.now()): boolean =>
  typeof entry.removedAt !== 'number' || entry.removedAt <= now - REMOVED_CONTENT_RETENTION_MS

/** Adds a removal to an existing atomic update. */
export function queueRemovedEntry(entry: RemovedEntry, writes: Record<string, unknown>): void {
  const id = getAdminDatabase().ref('removedContent').push().key
  writes[`removedContent/${id}`] = entry
}

/** Adds the deletion of entries past their retention to an existing atomic update. */
export async function queueExpiredRemovals(
  writes: Record<string, unknown>,
  now = Date.now()
): Promise<void> {
  const snapshot = await getAdminDatabase().ref('removedContent').once('value')
  const entries = (snapshot.val() ?? {}) as Record<string, { removedAt?: unknown }>
  for (const [id, entry] of Object.entries(entries)) {
    if (isRemovalExpired(entry ?? {}, now)) writes[`removedContent/${id}`] = null
  }
}
