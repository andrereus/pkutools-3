import { describe, it, expect } from 'vitest'
import { errorCode, failureReason } from '../app/utils/api-error'

// A failed own-food save is reported inside the message that confirms the diary
// entry, which means its reason has to be read off the error rather than shown
// by useApi. Reading it from the wrong place fails silently: every failure
// would come out as the generic "something went wrong", including the two that
// actually have something to say (list full, duplicate food).

// What a Nuxt $fetch rejection looks like for `createError({ statusCode,
// message, data: { code } })` — the body is wrapped once by $fetch, so the code
// sits two levels deep.
const fetchError = (code: string) => ({
  statusCode: 403,
  data: { statusCode: 403, message: 'Own food limit reached.', data: { code } }
})

const t = (key: string) => `t:${key}`
const te = (key: string) => key === 'errors.limit-reached' || key === 'errors.unexpected'

describe('errorCode', () => {
  it('reads the code out of a wrapped server error', () => {
    expect(errorCode(fetchError('limit-reached'))).toBe('limit-reached')
  })

  it('returns null for anything that carries no code', () => {
    expect(errorCode(new Error('Network request failed'))).toBeNull()
    expect(errorCode({ statusCode: 500, data: { message: 'Internal server error' } })).toBeNull()
    // Zod validation errors put an array of issues where the code object goes
    expect(errorCode({ statusCode: 400, data: { data: [{ path: ['name'] }] } })).toBeNull()
    expect(errorCode(null)).toBeNull()
    expect(errorCode(undefined)).toBeNull()
  })
})

describe('failureReason', () => {
  it('translates a known code', () => {
    expect(failureReason(fetchError('limit-reached'), t, te)).toBe('t:errors.limit-reached')
  })

  // A code without a translation must not reach the user as a raw slug.
  it('falls back to the generic message', () => {
    expect(failureReason(fetchError('some-new-code'), t, te)).toBe('t:errors.unexpected')
    expect(failureReason(new Error('offline'), t, te)).toBe('t:errors.unexpected')
  })
})
