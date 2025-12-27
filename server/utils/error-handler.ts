/**
 * Centralized error handler for server-side API routes
 * Handles Firebase auth errors, re-throws HTTP errors, and provides fallback for unexpected errors
 */
export function handleServerError(error: unknown): never {
  // Handle Firebase auth errors
  const firebaseError = error as { code?: string }
  if (
    firebaseError.code === 'auth/id-token-expired' ||
    firebaseError.code === 'auth/argument-error'
  ) {
    throw createError({
      statusCode: 401,
      message: 'Invalid or expired token'
    })
  }

  // Re-throw createError instances (already formatted HTTP errors)
  const httpError = error as { statusCode?: number }
  if (httpError.statusCode) {
    throw error
  }

  // Handle unexpected errors
  throw createError({
    statusCode: 500,
    message: 'Internal server error'
  })
}

