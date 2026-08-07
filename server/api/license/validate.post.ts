import { defineAuthedHandler } from '../../utils/handler'
import { licenseFlags } from '../../utils/license'

export default defineAuthedHandler(async ({ event }) => {
  const body = await readBody(event)
  const licenseKey = body.license

  if (!licenseKey || typeof licenseKey !== 'string') {
    throw createError({
      statusCode: 400,
      message: 'License key is required'
    })
  }

  const { premium, premiumAI } = licenseFlags(licenseKey)

  return {
    valid: premium,
    premium,
    premiumAI
  }
})
