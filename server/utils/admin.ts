import { getAdminDatabase } from './firebase-admin'

/**
 * Admins are listed as `admins/<uid>: true` in the Realtime Database. Clients
 * cannot write there. Signed-in users can read the list, which is how content
 * by an admin is shown as written by PKU Tools.
 * @param userId - The user's Firebase UID
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const snapshot = await getAdminDatabase().ref(`admins/${userId}`).once('value')
  return snapshot.val() === true
}
