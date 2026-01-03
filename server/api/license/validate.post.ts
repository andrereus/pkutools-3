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
    const validLicenseKey2 = config.pkutoolsLicenseKey2
    const isValid = licenseKey === validLicenseKey || licenseKey === validLicenseKey2
    const isPremiumAI = licenseKey === validLicenseKey2

    return {
      valid: isValid,
      premium: isValid,
      premiumAI: isPremiumAI
    }
  } catch (error: unknown) {
    handleServerError(error)
  }
})
