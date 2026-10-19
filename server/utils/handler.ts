import type { H3Event } from 'h3'
import { getAuthenticatedUser } from './auth'
import { handleServerError } from './error-handler'
import { isAdmin } from './admin'

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

// The same, for routes only admins may call. Everyone else gets a 403 before
// the route body runs.
export function defineAdminHandler(
  handler: (ctx: { event: H3Event; userId: string }) => unknown | Promise<unknown>
) {
  return defineAuthedHandler(async (ctx) => {
    if (!(await isAdmin(ctx.userId))) {
      throw createError({
        statusCode: 403,
        message: 'Admin access required',
        data: { code: 'forbidden' }
      })
    }
    return await handler(ctx)
  })
}
