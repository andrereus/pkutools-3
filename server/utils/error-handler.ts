/**
 * Centralized error handler for server-side API routes
 * Handles Firebase auth errors, re-throws HTTP errors, and provides fallback for unexpected errors
 */
export function handleServerError(error: unknown): never {
  // `error` is whatever was thrown, and that includes null and undefined — a
  // bare `throw` or a `Promise.reject()` without a reason both land here.
  // Reading a property off those raises a TypeError that escapes this function,
  // which is the one thing it exists to prevent, so every access is guarded.

  // Handle Firebase auth errors
  const firebaseError = error as { code?: string } | null | undefined
  if (
    firebaseError?.code === 'auth/id-token-expired' ||
    firebaseError?.code === 'auth/argument-error'
  ) {
    throw createError({
      statusCode: 401,
      message: 'Invalid or expired token'
    })
  }

  // Re-throw createError instances (already formatted HTTP errors)
  const httpError = error as { statusCode?: number } | null | undefined
  if (httpError?.statusCode) {
    throw error
  }

  // Handle unexpected errors
  throw createError({
    statusCode: 500,
    message: 'Internal server error'
  })
}
