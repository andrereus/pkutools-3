import { describe, expect, it } from 'vitest'
import { normalizeCommunityFoodComments } from '../app/composables/useCommunityFoodComments'

describe('community comment snapshots', () => {
  it('keeps valid comments in chronological order and upgrades a missing updatedAt', () => {
    expect(
      normalizeCommunityFoodComments({
        later: { authorId: 'user-2', text: 'Later', createdAt: 200, updatedAt: 220 },
        first: { authorId: 'user-1', text: 'First', createdAt: 100 }
      })
    ).toEqual([
      {
        '.key': 'first',
        authorId: 'user-1',
        text: 'First',
        createdAt: 100,
        updatedAt: 100
      },
      {
        '.key': 'later',
        authorId: 'user-2',
        text: 'Later',
        createdAt: 200,
        updatedAt: 220
      }
    ])
  })

  it('does not render malformed database records', () => {
    expect(
      normalizeCommunityFoodComments({
        noAuthor: { text: 'Text', createdAt: 100 },
        blank: { authorId: 'user-1', text: '   ', createdAt: 100 },
        badTime: { authorId: 'user-1', text: 'Text', createdAt: 'yesterday' },
        valid: { authorId: 'user-1', text: 'Visible', createdAt: 100, updatedAt: Number.NaN }
      })
    ).toEqual([
      {
        '.key': 'valid',
        authorId: 'user-1',
        text: 'Visible',
        createdAt: 100,
        updatedAt: 100
      }
    ])
  })
})
