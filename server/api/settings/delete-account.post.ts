import { getAdminDatabase, getAdminAuth } from '../../utils/firebase-admin'
import { handleServerError } from '../../utils/error-handler'
import { getAuthenticatedUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    const userId = await getAuthenticatedUser(event)

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

