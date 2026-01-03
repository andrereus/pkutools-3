import { getAuth } from 'firebase/auth'
import { useStore } from '../../stores/index'

const licenseCache = ref<{
  valid: boolean
  premium: boolean
  premiumAI?: boolean
  timestamp: number
} | null>(null)

const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
const isInitializing = ref(false)

export const useLicense = () => {
  const notifications = useNotifications()
  const store = useStore()

  const validateLicense = async (
    licenseKey: string
  ): Promise<{ valid: boolean; premium: boolean; premiumAI?: boolean }> => {
    try {
      // Check cache first
      if (licenseCache.value) {
        const age = Date.now() - licenseCache.value.timestamp
        if (age < CACHE_DURATION) {
          return {
            valid: licenseCache.value.valid,
            premium: licenseCache.value.premium,
            premiumAI: licenseCache.value.premiumAI
          }
        }
      }

      // Get auth token
      const auth = getAuth()
      const user = auth.currentUser
      if (!user) {
        throw new Error('User not authenticated')
      }

      const token = await user.getIdToken()

      // Call license validation API
      const response = await $fetch<{ valid: boolean; premium: boolean; premiumAI?: boolean }>('/api/license/validate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: {
          license: licenseKey
        }
      })

      // Cache the result
      licenseCache.value = {
        valid: response.valid,
        premium: response.premium,
        premiumAI: response.premiumAI,
        timestamp: Date.now()
      }

      return response
    } catch (error: unknown) {
      console.error('License validation error:', error)
      notifications.error('Failed to validate license. Please try again.')
      throw error
    }
  }

  // Automatically validate license on page load if license key exists
  const initializeLicense = async () => {
    // Don't initialize if already initializing or if cache exists
    if (isInitializing.value || licenseCache.value) {
      return
    }

    // Check if user is authenticated and has a license key
    const auth = getAuth()
    const user = auth.currentUser
    if (!user) {
      return
    }

    const settingsLicense = store.settings?.license
    if (!settingsLicense) {
      return
    }

    const licenseKey =
      typeof settingsLicense === 'string' ? settingsLicense : String(settingsLicense)
    if (licenseKey.trim().length === 0) {
      return
    }

    // Initialize in background (don't block UI)
    isInitializing.value = true
    try {
      await validateLicense(licenseKey)
    } catch (error) {
      // Silently fail - user can manually validate if needed
      console.error('Auto-license validation failed:', error)
    } finally {
      isInitializing.value = false
    }
  }

  const isPremium = computed(() => {
    // Only show premium if license was validated and cached as premium
    // We don't assume premium just because a license key exists - it must be validated
    return licenseCache.value?.premium === true
  })

  const isPremiumAI = computed(() => {
    // Check if user has premium+AI license
    return licenseCache.value?.premiumAI === true
  })

  const clearCache = () => {
    licenseCache.value = null
  }

  // Auto-initialize when composable is used and user is authenticated
  if (import.meta.client) {
    // Watch for user authentication and settings changes
    watch(
      () => [store.user, store.settings?.license],
      () => {
        if (!store.user || !store.settings?.license || licenseCache.value) {
          return
        }
        const settingsLicense = store.settings.license
        const licenseKey =
          typeof settingsLicense === 'string' ? settingsLicense : String(settingsLicense)
        if (licenseKey.trim().length > 0) {
          initializeLicense()
        }
      },
      { immediate: true }
    )
  }

  return {
    validateLicense,
    isPremium,
    isPremiumAI,
    clearCache,
    initializeLicense
  }
}
