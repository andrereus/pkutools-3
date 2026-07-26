import { describe, it, expect } from 'vitest'
import {
  COMMUNITY_FOOD_HIDE_THRESHOLD as CLIENT_THRESHOLD,
  isCommunityFoodHidden as isHiddenClient
} from '../app/utils/community-food'
import {
  COMMUNITY_FOOD_HIDE_THRESHOLD as SERVER_THRESHOLD,
  isCommunityFoodHidden as isHiddenServer
} from '../server/utils/community-food'

// A community food's score (likes - dislikes) decides whether other users still
// see it. The rule is implemented twice — once for search filtering in the
// client, once for duplicate checks and vote bookkeeping on the server — and the
// two copies drifting apart would mean a food that is hidden in search but still
// blocks new submissions (or vice versa).

describe('community food hide threshold', () => {
  it('keeps the client and server copies of the rule identical', () => {
    expect(CLIENT_THRESHOLD).toBe(SERVER_THRESHOLD)
    for (const score of [-10, -4, -3, -2, 0, 10]) {
      expect(isHiddenClient(score), `score ${score}`).toBe(isHiddenServer(score))
    }
  })

  // The exact cutoff matters in both directions: too low and a food nobody can
  // correct stays in search, too high and a handful of dislikes lets one user
  // bury someone else's contribution.
  it('hides a food only once its score drops below -3', () => {
    expect(isHiddenServer(-2)).toBe(false)
    expect(isHiddenServer(-3)).toBe(false)
    expect(isHiddenServer(-4)).toBe(true)
    expect(isHiddenServer(-100)).toBe(true)
    expect(isHiddenServer(0)).toBe(false)
    expect(isHiddenServer(100)).toBe(false)
  })
})
