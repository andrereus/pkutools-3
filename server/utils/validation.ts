import type { ZodError } from 'zod'

/**
 * Formats Zod validation errors into a user-friendly error message
 * and throws a formatted H3Error
 * @throws {H3Error} Always throws with statusCode 400
 */
export function formatValidationError(error: ZodError): never {
  const errorMessages = error.issues
    .map((issue) => {
      const path = issue.path.join('.')
      return `${path ? `${path}: ` : ''}${issue.message}`
    })
    .join(', ')

  throw createError({
    statusCode: 400,
    message: `Validation failed: ${errorMessages}`,
    data: error.issues
  })
}
