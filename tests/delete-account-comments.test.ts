import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeDatabase, installServerGlobals, requestEvent } from './helpers/server-harness'

installServerGlobals()

let fake = createFakeDatabase()
const deleteUser = vi.fn()

vi.mock(import('../server/utils/firebase-admin'), () => ({
  getAdminDatabase: () => fake.db,
  getAdminAuth: () => ({ deleteUser })
}))
vi.mock(import('../server/utils/auth'), () => ({ getAuthenticatedUser: async () => 'user-1' }))

const deleteAccount = (await import('../server/api/settings/delete-account.post'))
  .default as unknown as (event: unknown) => Promise<{ success: boolean }>

beforeEach(() => {
  fake = createFakeDatabase({
    'user-1': {
      ownFood: { own1: { name: 'My food' } }
    },
    communityFoods: { food1: { name: 'Rice cake', commentCount: 1 } },
    communityFoodComments: {
      food1: {
        comment1: {
          authorId: 'user-1',
          text: 'Check the serving size',
          createdAt: 100,
          updatedAt: 100
        }
      }
    }
  })
  deleteUser.mockReset()
})

describe('deleting an account with community comments', () => {
  it('keeps public comments and their count as community contributions', async () => {
    await expect(deleteAccount(requestEvent(undefined))).resolves.toEqual({ success: true })

    expect(fake.data['user-1']).toBeUndefined()
    expect(fake.data.communityFoodComments).toEqual({
      food1: {
        comment1: {
          authorId: 'user-1',
          text: 'Check the serving size',
          createdAt: 100,
          updatedAt: 100
        }
      }
    })
    expect(fake.data.communityFoods).toEqual({
      food1: { name: 'Rice cake', commentCount: 1 }
    })
    expect(deleteUser).toHaveBeenCalledWith('user-1')
  })
})
