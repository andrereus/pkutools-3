import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'
import { HttpError, installServerGlobals } from './helpers/server-harness'

// getAuthenticatedUser is the gate in front of every write endpoint: it decides
// whose Firebase subtree a request may touch. handleServerError decides what
// gets said back when something fails.

const verifyIdToken = vi.fn()
vi.mock(import('../server/utils/firebase-admin'), () => ({ verifyIdToken }))

// h3 is not a direct dependency, so the Nuxt auto-imports these modules rely on
// come from the shared harness rather than being stubbed again here.
installServerGlobals()

const { getAuthenticatedUser } = await import('../server/utils/auth')
const { handleServerError } = await import('../server/utils/error-handler')

/** An H3Event stand-in carrying just the headers these functions read. */
const eventWith = (headers: Record<string, string> = {}) => ({ headers }) as unknown as H3Event

beforeEach(() => {
  // restoreMocks (vitest.config.ts) covers the spy below, but not a vi.fn()
  // handed to a module factory — its call history has to be cleared by hand.
  verifyIdToken.mockReset()
  // The module logs the underlying failure; silence it for the expected cases.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('getAuthenticatedUser', () => {
  it('returns the uid from a verified token', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'user-1' })

    await expect(
      getAuthenticatedUser(eventWith({ authorization: 'Bearer good-token' }))
    ).resolves.toBe('user-1')
    expect(verifyIdToken).toHaveBeenCalledWith('good-token')
  })

  it('rejects a request with no authorization header', async () => {
    await expect(getAuthenticatedUser(eventWith())).rejects.toMatchObject({ statusCode: 401 })
    expect(verifyIdToken).not.toHaveBeenCalled()
  })

  // Anything that isn't a bearer token is refused before it reaches Firebase, so
  // a malformed header can never be mistaken for a credential.
  it.each([
    ['empty', ''],
    ['no scheme', 'good-token'],
    ['basic auth', 'Basic dXNlcjpwYXNz'],
    ['lowercase scheme', 'bearer good-token'],
    ['missing space', 'Bearergood-token']
  ])('rejects a %s authorization header', async (_label, header) => {
    await expect(getAuthenticatedUser(eventWith({ authorization: header }))).rejects.toMatchObject({
      statusCode: 401
    })
    expect(verifyIdToken).not.toHaveBeenCalled()
  })

  it('rejects a token Firebase refuses to verify', async () => {
    verifyIdToken.mockRejectedValue(
      Object.assign(new Error('Firebase ID token has expired'), { code: 'auth/id-token-expired' })
    )

    await expect(
      getAuthenticatedUser(eventWith({ authorization: 'Bearer expired-token' }))
    ).rejects.toMatchObject({ statusCode: 401, message: 'Invalid or expired token' })
  })

  // The underlying Firebase error can name project ids and internals; only the
  // generic message may reach the caller.
  it('does not leak the underlying verification error', async () => {
    verifyIdToken.mockRejectedValue(
      new Error('service account key /etc/secrets/sa.json is invalid')
    )

    await expect(
      getAuthenticatedUser(eventWith({ authorization: 'Bearer bad-token' }))
    ).rejects.toMatchObject({ message: 'Invalid or expired token' })
  })
})

describe('handleServerError', () => {
  it('turns a Firebase auth error into a 401', () => {
    for (const code of ['auth/id-token-expired', 'auth/argument-error']) {
      expect(() => handleServerError({ code })).toThrowError(
        expect.objectContaining({ statusCode: 401, message: 'Invalid or expired token' })
      )
    }
  })

  // Endpoints throw their own createError for things like a duplicate own food;
  // those must reach the client intact or the UI can't tell the cases apart.
  it('re-throws an already-formatted HTTP error unchanged', () => {
    const original = new HttpError({
      statusCode: 409,
      message: 'A similar food already exists in your own foods',
      data: { code: 'duplicate-own-food' }
    })

    expect(() => handleServerError(original)).toThrowError(original)
    try {
      handleServerError(original)
    } catch (error) {
      expect(error).toBe(original)
      expect((error as HttpError).data).toEqual({ code: 'duplicate-own-food' })
    }
  })

  // An unexpected throw can carry a stack, a database path or a credential.
  it('replaces an unexpected error with a generic 500', () => {
    const leaky = new Error('ECONNREFUSED 10.0.0.5:9000 while reading /user-1/settings')

    try {
      handleServerError(leaky)
      expect.unreachable('handleServerError must always throw')
    } catch (error) {
      expect((error as HttpError).statusCode).toBe(500)
      expect((error as HttpError).message).toBe('Internal server error')
      expect((error as HttpError).message).not.toContain('10.0.0.5')
    }
  })

  // null and undefined included: a bare `throw` or a `Promise.reject()` with no
  // reason reaches this as the catch-all for every authenticated route, and
  // reading `.code` off them used to raise a TypeError that escaped instead of
  // becoming a 500. Guarded on 2026-07-27.
  it('gives a generic 500 for anything else it is handed', () => {
    for (const value of ['a string', 42, new Error('boom'), { some: 'object' }, null, undefined]) {
      expect(() => handleServerError(value)).toThrowError(
        expect.objectContaining({ statusCode: 500, message: 'Internal server error' })
      )
    }
  })
})
