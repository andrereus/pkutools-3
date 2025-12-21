import { verifyIdToken } from '../../utils/firebase-admin'

export default defineEventHandler(async (event) => {
  try {
    // Get auth token from header
    const authHeader = getHeader(event, 'authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw createError({
        statusCode: 401,
        message: 'Missing or invalid authorization header'
      })
    }

    const token = authHeader.substring(7)

    // Verify token
    await verifyIdToken(token)

    // Get license key from request body
    const body = await readBody(event)
    const licenseKey = body.license

    if (!licenseKey || typeof licenseKey !== 'string') {
      throw createError({
        statusCode: 400,
        message: 'License key is required'
      })
    }

    // Compare with server-side config (never exposed to client)
    const config = useRuntimeConfig()
    const validLicenseKey = config.pkutoolsLicenseKey
    const isValid = licenseKey === validLicenseKey

    return {
      valid: isValid,
      premium: isValid
    }
  } catch (error: unknown) {
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

    // Re-throw createError instances
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
})
