import type { H3Event } from 'h3'
import { verifyIdToken } from './firebase-admin'

/**
 * Extracts and verifies the authentication token from the request header
 * Returns the authenticated user's ID
 * @throws {H3Error} If authorization header is missing, invalid, or token is expired
 */
export async function getAuthenticatedUser(event: H3Event): Promise<string> {
  const authHeader = getHeader(event, 'authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw createError({
      statusCode: 401,
      message: 'Missing or invalid authorization header'
    })
  }

  const token = authHeader.substring(7)

  try {
    const decodedToken = await verifyIdToken(token)
    return decodedToken.uid
  } catch (verifyError) {
    const error = verifyError as { code?: string; message?: string }
    console.error('Token verification failed:', error.code, error.message)
    throw createError({
      statusCode: 401,
      message: 'Invalid or expired token'
    })
  }
}
