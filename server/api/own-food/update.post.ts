import { verifyIdToken, getAdminDatabase } from '../../utils/firebase-admin'
import { OwnFoodUpdateSchema } from '../../types/schemas'
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

    // Verify token and get user ID
    let decodedToken
    try {
      decodedToken = await verifyIdToken(token)
    } catch (verifyError) {
      const error = verifyError as { code?: string; message?: string }
      console.error('Token verification failed:', error.code, error.message)
      throw createError({
        statusCode: 401,
        message: 'Invalid or expired token'
      })
    }
    const userId = decodedToken.uid

    // Get request body
    const body = await readBody(event)

    // Validate input
    const validation = OwnFoodUpdateSchema.safeParse(body)

    if (!validation.success) {
      // Format validation errors for better user feedback
      const errorMessages = validation.error.issues
        .map((issue) => {
          const path = issue.path.join('.')
          return `${path ? `${path}: ` : ''}${issue.message}`
        })
        .join(', ')

      throw createError({
        statusCode: 400,
        message: `Validation failed: ${errorMessages}`,
        data: validation.error.issues
      })
    }

    const { entryKey, data } = validation.data

    const db = getAdminDatabase()
    const ownFoodRef = db.ref(`/${userId}/ownFood/${entryKey}`)
    const ownFoodSnapshot = await ownFoodRef.once('value')
    const ownFood = ownFoodSnapshot.val()

    if (!ownFood) {
      throw createError({
        statusCode: 404,
        message: 'Own food entry not found'
      })
    }

    // Update the entry
    await ownFoodRef.update(data)

    return {
      success: true,
      key: entryKey
    }
  } catch (error: unknown) {
    handleServerError(error)
  }
})

