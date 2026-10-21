import { getAdminDatabase } from '../utils/firebase-admin'
import { CommunityProfileSchema } from '../types/schemas'
import { defineAuthedHandler } from '../utils/handler'
import { validateBody } from '../utils/validation'
import { communityNameKey, isNameKeyTaken, isReservedNameKey } from '../utils/community-name'

export default defineAuthedHandler(async ({ event, userId }) => {
  const { communityName } = await validateBody(event, CommunityProfileSchema)
  const profileRef = getAdminDatabase().ref(`communityProfiles/${userId}`)

  if (communityName === null) {
    await profileRef.remove()
    return { success: true, communityName: null }
  }

  const nameKey = communityNameKey(communityName)
  if (isReservedNameKey(nameKey)) {
    throw createError({
      statusCode: 400,
      message: 'This name is reserved',
      data: { code: 'community-name-reserved' }
    })
  }
  if (await isNameKeyTaken(userId, nameKey)) {
    throw createError({
      statusCode: 409,
      message: 'This name is taken',
      data: { code: 'community-name-taken' }
    })
  }

  await profileRef.set({ communityName, updatedAt: Date.now() })
  return { success: true, communityName }
})
