import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// The real module pulls in the Firebase Admin SDK. licenseFlags itself never
// touches the database, so stub the import away and test the pure mapping.
vi.mock(import('../server/utils/firebase-admin'), () => ({
  getAdminDatabase: vi.fn()
}))

const { licenseFlags } = await import('../server/utils/license')

const PREMIUM_KEY = 'premium-key-abc'
const PREMIUM_AI_KEY = 'premium-ai-key-xyz'

/** Stubs the Nuxt auto-imported useRuntimeConfig for one assertion. */
const withConfig = (pkutoolsLicenseKey?: string, pkutoolsLicenseKey2?: string) => {
  vi.stubGlobal('useRuntimeConfig', () => ({ pkutoolsLicenseKey, pkutoolsLicenseKey2 }))
}

beforeEach(() => {
  withConfig(PREMIUM_KEY, PREMIUM_AI_KEY)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('licenseFlags', () => {
  it('grants premium (but not AI) for the tier-1 key', () => {
    expect(licenseFlags(PREMIUM_KEY)).toEqual({ premium: true, premiumAI: false })
  })

  it('grants premium and AI for the tier-2 key', () => {
    expect(licenseFlags(PREMIUM_AI_KEY)).toEqual({ premium: true, premiumAI: true })
  })

  it('grants nothing for a wrong or absent key', () => {
    for (const key of ['wrong-key', '', null, undefined]) {
      expect(licenseFlags(key)).toEqual({ premium: false, premiumAI: false })
    }
  })

  it('does not match on a prefix, suffix or different case', () => {
    for (const key of [
      PREMIUM_KEY.toUpperCase(),
      PREMIUM_KEY.slice(0, -1),
      `${PREMIUM_KEY} `,
      ` ${PREMIUM_KEY}`,
      `${PREMIUM_KEY}extra`
    ]) {
      expect(licenseFlags(key).premium).toBe(false)
    }
  })

  // Missing configuration must fail closed; absent keys must never match.
  describe('fails closed when the license env vars are not configured', () => {
    it('grants nothing to a user with no license when both keys are unset', () => {
      withConfig(undefined, undefined)
      expect(licenseFlags(undefined)).toEqual({ premium: false, premiumAI: false })
      expect(licenseFlags(null)).toEqual({ premium: false, premiumAI: false })
    })

    it('grants nothing when the configured key is an empty string', () => {
      withConfig('', '')
      expect(licenseFlags('')).toEqual({ premium: false, premiumAI: false })
      expect(licenseFlags(undefined)).toEqual({ premium: false, premiumAI: false })
    })

    it('still honours a configured key when only the other one is unset', () => {
      withConfig(PREMIUM_KEY, undefined)
      expect(licenseFlags(PREMIUM_KEY)).toEqual({ premium: true, premiumAI: false })
      expect(licenseFlags(undefined)).toEqual({ premium: false, premiumAI: false })

      withConfig(undefined, PREMIUM_AI_KEY)
      expect(licenseFlags(PREMIUM_AI_KEY)).toEqual({ premium: true, premiumAI: true })
      expect(licenseFlags(undefined)).toEqual({ premium: false, premiumAI: false })
    })

    it('grants nothing for a non-string config value', () => {
      // e.g. an env var that arrived as a number or object through some layer
      vi.stubGlobal('useRuntimeConfig', () => ({
        pkutoolsLicenseKey: 12345 as unknown as string,
        pkutoolsLicenseKey2: {} as unknown as string
      }))
      expect(licenseFlags(12345 as unknown as string)).toEqual({
        premium: false,
        premiumAI: false
      })
    })
  })
})
