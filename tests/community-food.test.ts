import { describe, it, expect } from 'vitest'
import {
  COMMUNITY_FOOD_HIDE_THRESHOLD as CLIENT_THRESHOLD,
  isCommunityFoodHidden as isHiddenClient,
  SHAREABLE_FOOD_SOURCES as CLIENT_SHAREABLE,
  isShareableSource as isShareableClient
} from '../app/utils/community-food'
import {
  COMMUNITY_FOOD_HIDE_THRESHOLD as SERVER_THRESHOLD,
  isCommunityFoodHidden as isHiddenServer,
  SHAREABLE_FOOD_SOURCES as SERVER_SHAREABLE,
  isShareableSource as isShareableServer
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

// Which origins may be published is the second rule with two copies: the client
// decides whether to offer the option, the server whether to honor it. A client
// that offers more than the server accepts is a save that fails at the end.
describe('shareable food sources', () => {
  it('keeps the client and server copies of the rule identical', () => {
    expect(CLIENT_SHAREABLE).toEqual(SERVER_SHAREABLE)
    for (const source of [
      'manual',
      'barcode',
      'ai-label',
      'ai-estimate',
      'bls',
      'usda',
      'own-food',
      'community',
      null,
      undefined
    ]) {
      expect(isShareableClient(source), `source ${source}`).toBe(isShareableServer(source))
    }
  })

  // An estimate is a guess, and the search origins are already searchable for
  // everyone — publishing either would fill the community database with values
  // nobody can check against a label.
  it('allows only the calculations the user made themselves', () => {
    expect(isShareableServer('manual')).toBe(true)
    expect(isShareableServer('barcode')).toBe(true)
    expect(isShareableServer('ai-label')).toBe(true)

    expect(isShareableServer('ai-estimate')).toBe(false)
    expect(isShareableServer('bls')).toBe(false)
    expect(isShareableServer('usda')).toBe(false)
    expect(isShareableServer('community')).toBe(false)
  })

  // Own foods written before provenance existed have no source at all, and they
  // could always be shared — that must not change under them.
  it('treats a missing source as shareable', () => {
    expect(isShareableServer(null)).toBe(true)
    expect(isShareableServer(undefined)).toBe(true)
    expect(isShareableServer('')).toBe(true)
  })
})
