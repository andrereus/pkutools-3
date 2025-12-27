import { verifyIdToken } from '../../utils/firebase-admin'
import { handleServerError } from '../../utils/error-handler'

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
    handleServerError(error)
  }
})
