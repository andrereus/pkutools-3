import { getAdminDatabase } from '../utils/firebase-admin'
import { CommunityProfileSchema } from '../types/schemas'
import { defineAuthedHandler } from '../utils/handler'
import { validateBody } from '../utils/validation'

// Names that would pass for the app itself, whose own comments carry a badge.
const RESERVED_NAMES = ['pkutools', 'admin', 'administrator', 'moderator']

const isReservedName = (name: string): boolean => {
  const letters = name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
  return RESERVED_NAMES.some((reserved) =>
    reserved === 'pkutools' ? letters.includes(reserved) : letters === reserved
  )
}

export default defineAuthedHandler(async ({ event, userId }) => {
  const { nickname } = await validateBody(event, CommunityProfileSchema)
  const profileRef = getAdminDatabase().ref(`communityProfiles/${userId}`)

  if (nickname === null) {
    await profileRef.remove()
    return { success: true, nickname: null }
  }
  if (isReservedName(nickname)) {
    throw createError({
      statusCode: 400,
      message: 'This name is reserved',
      data: { code: 'community-name-reserved' }
    })
  }

  await profileRef.set({ nickname, updatedAt: Date.now() })
  return { success: true, nickname }
})
