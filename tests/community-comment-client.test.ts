import { describe, expect, it } from 'vitest'
import { normalizeCommunityFoodComments } from '../app/composables/useCommunityFoodComments'

describe('community comment snapshots', () => {
  it('interleaves comments and general food edits chronologically', () => {
    expect(
      normalizeCommunityFoodComments({
        reply: { authorId: 'user-1', text: 'Thanks!', createdAt: 300 },
        edit: {
          type: 'content-update',
          createdAt: 200,
          changedFields: ['phe', 'salt', 'note']
        },
        feedback: { authorId: 'user-2', text: 'Check the label', createdAt: 100 }
      })
    ).toEqual([
      {
        '.key': 'feedback',
        type: 'comment',
        authorId: 'user-2',
        text: 'Check the label',
        createdAt: 100,
        updatedAt: 100
      },
      {
        '.key': 'edit',
        type: 'content-update',
        createdAt: 200,
        changedFields: ['phe', 'salt', 'note']
      },
      {
        '.key': 'reply',
        type: 'comment',
        authorId: 'user-1',
        text: 'Thanks!',
        createdAt: 300,
        updatedAt: 300
      }
    ])
  })

  it('keeps recognized field names once each without passing any content through', () => {
    expect(
      normalizeCommunityFoodComments({
        edit: {
          type: 'content-update',
          createdAt: 100,
          changedFields: [
            'note',
            'retired-field',
            'phe',
            'note',
            { field: 'name', before: 'Private text' }
          ],
          changes: [{ field: 'note', before: 'Private old text', after: 'Private new text' }]
        }
      })
    ).toEqual([
      {
        '.key': 'edit',
        type: 'content-update',
        createdAt: 100,
        changedFields: ['phe', 'note']
      }
    ])
  })

  it.each(
    [undefined, null, [], ['retired-field'], [null, 12, {}]].map((changedFields) => ({
      changedFields
    }))
  )(
    'keeps a general edit notice when no field names are recognized: $changedFields',
    ({ changedFields }) => {
      expect(
        normalizeCommunityFoodComments({
          edit: { type: 'content-update', createdAt: 100, changedFields }
        })
      ).toEqual([{ '.key': 'edit', type: 'content-update', createdAt: 100, changedFields: [] }])
    }
  )

  it('uses database key order for equal timestamps, independent of locale collation', () => {
    const comment = { authorId: 'user-1', text: 'Comment', createdAt: 100 }
    const history = { type: 'content-update', createdAt: 100, changedFields: ['phe'] }
    const entries = normalizeCommunityFoodComments({
      '-Naaa': comment,
      '-N_ab': history,
      '-NAaa': comment,
      '-N-ab': history
    })
    expect(entries.map((entry) => entry['.key'])).toEqual(['-N-ab', '-NAaa', '-N_ab', '-Naaa'])
  })

  it('keeps valid comments in chronological order and upgrades a missing updatedAt', () => {
    expect(
      normalizeCommunityFoodComments({
        later: {
          type: 'comment',
          authorId: 'user-2',
          text: 'Later',
          createdAt: 200,
          updatedAt: 220
        },
        first: { authorId: 'user-1', text: 'First', createdAt: 100 }
      })
    ).toEqual([
      {
        '.key': 'first',
        type: 'comment',
        authorId: 'user-1',
        text: 'First',
        createdAt: 100,
        updatedAt: 100
      },
      {
        '.key': 'later',
        type: 'comment',
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
        type: 'comment',
        authorId: 'user-1',
        text: 'Visible',
        createdAt: 100,
        updatedAt: 100
      }
    ])
  })
})
