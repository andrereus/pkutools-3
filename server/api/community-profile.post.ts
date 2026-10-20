import { getAdminDatabase } from '../utils/firebase-admin'
import { CommunityProfileSchema } from '../types/schemas'
import { defineAuthedHandler } from '../utils/handler'
import { validateBody } from '../utils/validation'
import {
  claimNameKey,
  communityNameKey,
  currentNameKey,
  isReservedNameKey,
  queueNameKeyRelease
} from '../utils/community-name'

export default defineAuthedHandler(async ({ event, userId }) => {
  const { nickname } = await validateBody(event, CommunityProfileSchema)
  const previousKey = await currentNameKey(userId)
  const writes: Record<string, unknown> = {}

  if (nickname === null) {
    writes[`communityProfiles/${userId}`] = null
    await queueNameKeyRelease(writes, userId, previousKey)
    await getAdminDatabase().ref().update(writes)
    return { success: true, nickname: null }
  }

  const key = communityNameKey(nickname)
  if (isReservedNameKey(key)) {
    throw createError({
      statusCode: 400,
      message: 'This name is reserved',
      data: { code: 'community-name-reserved' }
    })
  }
  if (!(await claimNameKey(userId, key))) {
    throw createError({
      statusCode: 409,
      message: 'This name is taken',
      data: { code: 'community-name-taken' }
    })
  }

  writes[`communityProfiles/${userId}`] = { nickname, updatedAt: Date.now() }
  if (previousKey !== key) await queueNameKeyRelease(writes, userId, previousKey)
  await getAdminDatabase().ref().update(writes)
  return { success: true, nickname }
})
