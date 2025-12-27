import { verifyIdToken, getAdminDatabase } from '../../utils/firebase-admin'
import { OwnFoodSchema } from '../../types/schemas'
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
    const decodedToken = await verifyIdToken(token)
    const userId = decodedToken.uid

    // Get request body
    const body = await readBody(event)

    // Validate input with Zod schema
    const validation = OwnFoodSchema.safeParse(body)

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

    // Write to Firebase via Admin SDK
    const db = getAdminDatabase()
    const ownFoodRef = db.ref(`/${userId}/ownFood`)
    const newRef = ownFoodRef.push()
    await newRef.set(validation.data)

    return {
      success: true,
      key: newRef.key
    }
  } catch (error: unknown) {
    handleServerError(error)
  }
})
