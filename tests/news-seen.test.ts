import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeDatabase, installServerGlobals, requestEvent } from './helpers/server-harness'

// What an account has seen in News, kept so every device shows the same blue
// dots and bell.

installServerGlobals()

let fake = createFakeDatabase()
vi.mock(import('../server/utils/firebase-admin'), () => ({ getAdminDatabase: () => fake.db }))
vi.mock(import('../server/utils/auth'), () => ({ getAuthenticatedUser: async () => 'user-1' }))

const saveSeen = (await import('../server/api/news-seen.post')).default as unknown as (
  event: unknown
) => Promise<unknown>

beforeEach(() => {
  fake = createFakeDatabase()
})

describe('news seen', () => {
  it('only ever moves the account’s positions forward', async () => {
    await saveSeen(requestEvent({ lastReadAt: 200, lastSeenRevision: 5 }))
    await saveSeen(requestEvent({ lastReadAt: 100, lastSeenRevision: 7 }))
    expect(fake.data['user-1']).toEqual({ newsSeen: { lastReadAt: 200, lastSeenRevision: 7 } })
  })

  it('rejects a request without a position', async () => {
    await expect(saveSeen(requestEvent({}))).rejects.toMatchObject({ statusCode: 400 })
    expect(fake.data).toEqual({})
  })
})
