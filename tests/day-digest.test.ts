import { describe, expect, it } from 'vitest'
import { entriesOfDay, entriesOfToday } from '../app/utils/day-digest'

// The diary lists a day's News entries by the reader's calendar day.

const at = (iso: string) => new Date(iso).getTime()

describe('entries of a diary day', () => {
  const entries = [
    { key: 'post-1', kind: 'post', createdAt: at('2026-10-20T09:00:00') },
    { key: 'food-1', kind: 'food-shared', createdAt: at('2026-10-20T15:00:00') },
    { key: 'note-1', kind: 'note', createdAt: at('2026-10-19T23:59:00') },
    { key: 'streak-30', kind: 'streak', createdAt: 0, date: '2026-10-20' },
    {
      key: 'food-2',
      kind: 'food-shared',
      createdAt: at('2026-10-01T12:00:00'),
      contentUpdatedAt: at('2026-10-20T12:00:00')
    }
  ]

  it('lists the streak first, then the rest newest first', () => {
    expect(entriesOfDay(entries, '2026-10-20').map((entry) => entry.key)).toEqual([
      'streak-30',
      'food-1',
      'food-2',
      'post-1'
    ])
  })

  it('places an edited food on the day of its edit, as News dates it', () => {
    expect(entriesOfDay(entries, '2026-10-01')).toEqual([])
  })

  it('keeps entries on their own day', () => {
    expect(entriesOfDay(entries, '2026-10-19').map((entry) => entry.key)).toEqual(['note-1'])
  })
})

describe('entries of today', () => {
  const now = at('2026-10-20T08:00:00')
  const entries = [
    { key: 'post-evening', kind: 'post', createdAt: at('2026-10-19T21:00:00') },
    { key: 'post-morning', kind: 'post', createdAt: at('2026-10-19T07:00:00') },
    { key: 'post-today', kind: 'post', createdAt: at('2026-10-20T07:30:00') },
    { key: 'streak-yesterday', kind: 'streak', createdAt: 0, date: '2026-10-19' },
    { key: 'streak-today', kind: 'streak', createdAt: 0, date: '2026-10-20' }
  ]

  it('reaches back 24 hours, so last evening is still there in the morning', () => {
    expect(entriesOfToday(entries, now).map((entry) => entry.key)).toEqual([
      'streak-today',
      'post-today',
      'post-evening'
    ])
  })
})
