import { defineAuthedHandler } from '../../utils/handler'
import { licenseFlags } from '../../utils/license'

// Auth is verified by the wrapper; we only need the token to be valid, not the userId.
export default defineAuthedHandler(async ({ event }) => {
  // Get license key from request body
  const body = await readBody(event)
  const licenseKey = body.license

  if (!licenseKey || typeof licenseKey !== 'string') {
    throw createError({
      statusCode: 400,
      message: 'License key is required'
    })
  }

  // Compare against server-side config (never exposed to client)
  const { premium, premiumAI } = licenseFlags(licenseKey)

  return {
    valid: premium,
    premium,
    premiumAI
  }
})
