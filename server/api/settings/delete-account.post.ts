import { getAdminDatabase, getAdminAuth } from '../../utils/firebase-admin'
import { defineAuthedHandler } from '../../utils/handler'

export default defineAuthedHandler(async ({ userId }) => {
  const db = getAdminDatabase()
  const auth = getAdminAuth()

  // Shared foods, votes and community comments remain as contributions after
  // account deletion. Only the private subtree is removed; once the Auth user
  // is deleted, retained comments can no longer be edited by that account.
  const userDataRef = db.ref(`/${userId}`)
  await userDataRef.remove()

  // Delete the user account from Firebase Auth
  await auth.deleteUser(userId)

  return { success: true }
})
