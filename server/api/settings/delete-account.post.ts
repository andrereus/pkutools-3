import { getAdminDatabase, getAdminAuth } from '../../utils/firebase-admin'
import { defineAuthedHandler } from '../../utils/handler'

export default defineAuthedHandler(async ({ userId }) => {
  const db = getAdminDatabase()
  const auth = getAdminAuth()

  // Delete the user's private database subtree
  const userDataRef = db.ref(`/${userId}`)
  await userDataRef.remove()

  // Delete the user account from Firebase Auth
  await auth.deleteUser(userId)

  return { success: true }
})
