import { verifyIdToken, getAdminDatabase, getAdminAuth } from '../../utils/firebase-admin'
import { handleServerError } from '../../utils/error-handler'

export default defineEventHandler(async (event) => {
  try {
    const authHeader = getHeader(event, 'authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw createError({
        statusCode: 401,
        message: 'Missing or invalid authorization header'
      })
    }

    const token = authHeader.substring(7)
    const decodedToken = await verifyIdToken(token)
    const userId = decodedToken.uid

    const db = getAdminDatabase()
    const auth = getAdminAuth()

    // Delete all user data from database
    const userDataRef = db.ref(`/${userId}`)
    await userDataRef.remove()

    // Delete the user account from Firebase Auth
    await auth.deleteUser(userId)

    return { success: true }
  } catch (error: unknown) {
    handleServerError(error)
  }
})

