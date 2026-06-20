import type { H3Event } from 'h3'
import { getAuthenticatedUser } from './auth'
import { handleServerError } from './error-handler'

// Wraps a route with bearer-token auth and the shared error handler, so each
// route body holds only its real logic. The handler gets the verified userId
// and the event (destructure whichever it needs); read params / body off event.
export function defineAuthedHandler(
  handler: (ctx: { event: H3Event; userId: string }) => unknown | Promise<unknown>
) {
  return defineEventHandler(async (event) => {
    try {
      const userId = await getAuthenticatedUser(event)
      return await handler({ event, userId })
    } catch (error: unknown) {
      handleServerError(error)
    }
  })
}
