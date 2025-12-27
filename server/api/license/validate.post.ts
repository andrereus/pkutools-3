import { handleServerError } from '../../utils/error-handler'
import { getAuthenticatedUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    // Verify authentication (we don't need userId, just verify the token is valid)
    await getAuthenticatedUser(event)

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
