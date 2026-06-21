import { getAdminDatabase } from '../../utils/firebase-admin'
import { ServerValue } from 'firebase-admin/database'
import { CommunityVoteSchema } from '../../types/schemas'
import { defineAuthedHandler } from '../../utils/handler'
import { validateBody } from '../../utils/validation'
import { isCommunityFoodHidden } from '../../utils/community-food'

export default defineAuthedHandler(async ({ event, userId }) => {
  const { communityFoodKey, vote } = await validateBody(event, CommunityVoteSchema)

  const db = getAdminDatabase()

  // Get the community food to verify it exists and get contributor
  const communityFoodRef = db.ref(`communityFoods/${communityFoodKey}`)
  const communityFoodSnapshot = await communityFoodRef.once('value')
  const communityFood = communityFoodSnapshot.val()

  if (!communityFood) {
    throw createError({
      statusCode: 404,
      message: 'Community food not found'
    })
  }

  // Prevent users from voting on their own foods
  if (communityFood.contributorId === userId) {
    throw createError({
      statusCode: 403,
      message: 'Cannot vote on your own food'
    })
  }

  // Get user's existing vote from voterIds on the community food
  const voterRef = db.ref(`communityFoods/${communityFoodKey}/voterIds/${userId}`)
  const existingVoteSnapshot = await voterRef.once('value')
  const existingVote = existingVoteSnapshot.val() // Will be 1, -1, or null

  let likeDelta = 0
  let dislikeDelta = 0

  if (existingVote !== null) {
    if (existingVote === vote) {
      // Same vote - toggle off (remove vote)
      await voterRef.remove()

      if (vote === 1) {
        likeDelta = -1
      } else {
        dislikeDelta = -1
      }
    } else {
      // Different vote - switch vote
      await voterRef.set(vote)

      if (vote === 1) {
        // Switching from dislike to like
        likeDelta = 1
        dislikeDelta = -1
      } else {
        // Switching from like to dislike
        likeDelta = -1
        dislikeDelta = 1
      }
    }
  } else {
    // New vote - store the vote value (1 or -1)
    await voterRef.set(vote)

    if (vote === 1) {
      likeDelta = 1
    } else {
      dislikeDelta = 1
    }
  }

  // Apply the changes with atomic server-side increments so concurrent votes
  // from different users can't overwrite each other (lost updates).
  await communityFoodRef.update({
    likes: ServerValue.increment(likeDelta),
    dislikes: ServerValue.increment(dislikeDelta),
    score: ServerValue.increment(likeDelta - dislikeDelta)
  })

  // Optimistic values for immediate UI feedback; the client's realtime listener
  // reconciles with the authoritative counts.
  const newLikes = Math.max(0, (communityFood.likes || 0) + likeDelta)
  const newDislikes = Math.max(0, (communityFood.dislikes || 0) + dislikeDelta)
  const newScore = newLikes - newDislikes

  return {
    success: true,
    likes: newLikes,
    dislikes: newDislikes,
    score: newScore,
    hidden: isCommunityFoodHidden(newScore)
  }
})
