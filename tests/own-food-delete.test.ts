import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFakeDatabase,
  installServerGlobals,
  requestEvent,
  type WriteFailure
} from './helpers/server-harness'

// An own food and its community copy are one logical record. Deleting them in
// separate requests can leave either half behind when the second write fails,
// so this route has the same atomicity requirement as save and update.

installServerGlobals()

let fake = createFakeDatabase()

vi.mock(import('../server/utils/firebase-admin'), () => ({ getAdminDatabase: () => fake.db }))
vi.mock(import('../server/utils/auth'), () => ({ getAuthenticatedUser: async () => 'owner-1' }))

const deleteOwnFood = (await import('../server/api/own-food/delete.post')).default as unknown as (
  event: unknown
) => Promise<{ success: boolean; key: string }>

const seed = (ownFood: Record<string, unknown>, failWrite?: WriteFailure) => {
  fake = createFakeDatabase(
    {
      'owner-1': { ownFood: { entry1: ownFood } },
      communityFoods: {
        community1: {
          name: 'Oat drink',
          contributorId: 'owner-1',
          ownFoodKey: 'entry1'
        }
      }
    },
    failWrite
  )
}

const request = () => requestEvent({ entryKey: 'entry1' })
const ownFood = () =>
  (fake.data['owner-1'] as { ownFood?: Record<string, unknown> } | undefined)?.ownFood?.entry1
const communityFood = () =>
  (fake.data.communityFoods as Record<string, unknown> | undefined)?.community1

beforeEach(() => {
  seed({
    name: 'Oat drink',
    phe: 50,
    kcal: 45,
    shared: true,
    communityKey: 'community1'
  })
})

describe('deleting an own food', () => {
  it('removes the own food and its community copy together', async () => {
    await expect(deleteOwnFood(request())).resolves.toEqual({ success: true, key: 'entry1' })

    expect(ownFood()).toBeUndefined()
    expect(communityFood()).toBeUndefined()
  })

  it('removes the community food comments in the same write', async () => {
    fake.data.communityFoodComments = {
      community1: {
        comment1: {
          authorId: 'commenter-1',
          text: 'Check the serving size',
          createdAt: 100,
          updatedAt: 100
        }
      }
    }
    await deleteOwnFood(request())

    expect(fake.data.communityFoodComments).toBeUndefined()
  })

  it('removes only the own food when it has no community pointer', async () => {
    seed({ name: 'Oat drink', phe: 50, kcal: 45, shared: false })

    await deleteOwnFood(request())

    expect(ownFood()).toBeUndefined()
    expect(communityFood()).toBeDefined()
  })

  // Older non-atomic writes could leave the flag and pointer out of sync. The
  // pointer identifies the public copy reliably even when the flag does not.
  it('cleans up a pointed-to community copy even when the shared flag drifted', async () => {
    seed({
      name: 'Oat drink',
      phe: 50,
      kcal: 45,
      shared: false,
      communityKey: 'community1'
    })

    await deleteOwnFood(request())

    expect(ownFood()).toBeUndefined()
    expect(communityFood()).toBeUndefined()
  })

  it('does not delete a community food when a malformed pointer targets another record', async () => {
    seed({
      name: 'Oat drink',
      phe: 50,
      kcal: 45,
      shared: true,
      communityKey: 'community1'
    })
    fake.data.communityFoods = {
      community1: {
        name: "Someone else's food",
        contributorId: 'owner-2',
        ownFoodKey: 'entry-other'
      }
    }

    await deleteOwnFood(request())

    expect(ownFood()).toBeUndefined()
    expect(communityFood()).toBeDefined()
  })

  it('leaves both records intact when the atomic write fails', async () => {
    const failWrite: WriteFailure = (operation) => operation === 'update'
    seed(
      {
        name: 'Oat drink',
        phe: 50,
        kcal: 45,
        shared: true,
        communityKey: 'community1'
      },
      failWrite
    )

    await expect(deleteOwnFood(request())).rejects.toMatchObject({ statusCode: 500 })

    expect(ownFood()).toBeDefined()
    expect(communityFood()).toBeDefined()
  })
})
