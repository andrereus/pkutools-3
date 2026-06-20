import type { ZodError, ZodType } from 'zod'
import type { H3Event } from 'h3'

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

// Reads the request body and validates it against a Zod schema, throwing the
// shared translated 400 on failure. Returns the typed, parsed data.
export async function validateBody<T>(event: H3Event, schema: ZodType<T>): Promise<T> {
  const validation = schema.safeParse(await readBody(event))
  if (!validation.success) {
    formatValidationError(validation.error)
  }
  return validation.data
}
