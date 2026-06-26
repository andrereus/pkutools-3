import { getAuth } from 'firebase/auth'

export const useApi = () => {
  const errorHandler = useErrorHandler()
  const { locale } = useI18n()

  // ============================================================================
  // Helper Functions
  // ============================================================================

  const getAuthToken = async (): Promise<string> => {
    const auth = getAuth()
    const user = auth.currentUser
    if (!user) {
      throw new Error('User not authenticated')
    }
    return await user.getIdToken()
  }

  // Authenticated $fetch: attaches the bearer token and routes failures through
  // the shared error handler. Body is omitted entirely when undefined (DELETEs).
  const request = async <T>(
    url: string,
    label: string,
    method: 'POST' | 'PUT' | 'DELETE',
    body?: unknown
  ): Promise<T> => {
    try {
      const token = await getAuthToken()
      // Cast: $fetch maps internal routes to TypedInternalResponse; T is the
      // caller-declared shape and is what every endpoint actually returns.
      return (await $fetch<T>(url, {
        method,
        headers: { Authorization: `Bearer ${token}` },
        ...(body !== undefined ? { body } : {})
      })) as T
    } catch (error: unknown) {
      errorHandler.handleError(error, label)
      throw error
    }
  }

  // ============================================================================
  // Diary Operations
  // ============================================================================

  const createDiaryDay = (data: {
    date: string
    phe: number
    kcal: number
  }): Promise<{ success: boolean; key?: string }> =>
    request('/api/diary/days', 'Create diary day', 'POST', data)

  const addFoodItemToDiary = (data: {
    date?: string
    name: string
    emoji?: string | null
    icon?: string | null
    pheReference?: number | null
    kcalReference?: number | null
    weight: number
    phe: number
    kcal: number
    note?: string | null
    communityFoodKey?: string | null // Optional: tracks usage count and stored in diary entry
  }): Promise<{ success: boolean; key?: string; updated?: boolean }> =>
    request('/api/diary/food-items', 'Add food item to diary', 'POST', data)

  const updateDiaryDay = (data: {
    entryKey: string
    date?: string
    phe: number
    kcal: number
    log?: Array<unknown>
    incomplete?: boolean
  }): Promise<{ success: boolean; key?: string; updated?: boolean }> =>
    request(`/api/diary/days/${data.entryKey}`, 'Update diary day', 'PUT', {
      date: data.date,
      phe: data.phe,
      kcal: data.kcal,
      log: data.log,
      incomplete: data.incomplete
    })

  const updateFoodItemInDiary = (data: {
    entryKey: string
    logIndex: number
    entry: {
      name: string
      emoji?: string | null
      icon?: string | null
      pheReference?: number | null
      kcalReference?: number | null
      weight: number
      phe: number
      kcal: number
      note?: string | null
    }
  }): Promise<{ success: boolean; key?: string }> =>
    request(`/api/diary/food-items/${data.entryKey}`, 'Update food item in diary', 'PUT', {
      logIndex: data.logIndex,
      entry: data.entry
    })

  const deleteDiaryDay = (entryKey: string): Promise<{ success: boolean; key?: string }> =>
    request(`/api/diary/days/${entryKey}`, 'Delete diary day', 'DELETE')

  const deleteFoodItemFromDiary = (data: {
    entryKey: string
    logIndex: number
  }): Promise<{ success: boolean; key?: string; deletedLogIndex?: number }> =>
    request(`/api/diary/food-items/${data.entryKey}`, 'Delete food item from diary', 'DELETE', {
      logIndex: data.logIndex
    })

  // ============================================================================
  // Lab Values Operations
  // ============================================================================

  const saveLabValue = (data: {
    date: string
    phe?: number | null
    tyrosine?: number | null
  }): Promise<{ success: boolean; key?: string }> =>
    request('/api/lab-values/save', 'Save lab value', 'POST', data)

  const updateLabValue = (data: {
    entryKey: string
    date: string
    phe?: number | null
    tyrosine?: number | null
  }): Promise<{ success: boolean; key?: string }> =>
    request('/api/lab-values/update', 'Update lab value', 'POST', {
      entryKey: data.entryKey,
      data: {
        date: data.date,
        phe: data.phe,
        tyrosine: data.tyrosine
      }
    })

  const deleteLabValue = (data: {
    entryKey: string
  }): Promise<{ success: boolean; key?: string }> =>
    request('/api/lab-values/delete', 'Delete lab value', 'POST', data)

  // ============================================================================
  // Own Food Operations
  // ============================================================================

  const saveOwnFood = (data: {
    name: string
    icon?: string | null
    emoji?: string | null
    phe: number
    kcal: number
    note?: string | null
    shared?: boolean
  }): Promise<{ success: boolean; key?: string; communityKey?: string }> =>
    request('/api/own-food/save', 'Save own food', 'POST', { ...data, locale: locale.value })

  const updateOwnFood = (data: {
    entryKey: string
    name: string
    icon?: string | null
    emoji?: string | null
    phe: number
    kcal: number
    note?: string | null
    shared?: boolean
  }): Promise<{ success: boolean; key?: string; communityKey?: string | null }> =>
    request('/api/own-food/update', 'Update own food', 'POST', {
      entryKey: data.entryKey,
      locale: locale.value,
      data: {
        name: data.name,
        icon: data.icon,
        emoji: data.emoji,
        phe: data.phe,
        note: data.note,
        kcal: data.kcal,
        shared: data.shared
      }
    })

  const deleteOwnFood = (data: { entryKey: string }): Promise<{ success: boolean; key?: string }> =>
    request('/api/own-food/delete', 'Delete own food', 'POST', data)

  // ============================================================================
  // Settings Operations
  // ============================================================================

  const updateSettings = (data: {
    maxPhe?: number | null
    maxKcal?: number | null
    bloodPheMin?: number | null
    bloodPheMax?: number | null
    bloodTyrMin?: number | null
    bloodTyrMax?: number | null
    labUnit?: 'mgdl' | 'umoll'
    progressStyle?: 'bars' | 'circles'
    preferredTool?: 'ai-calculator' | 'food-search' | 'barcode-scanner' | 'phe-calculator'
    license?: string | null
  }): Promise<{ success: boolean }> =>
    request('/api/settings/update', 'Update settings', 'POST', data)

  const updateConsent = (data: {
    healthDataConsent?: boolean
    emailConsent?: boolean
  }): Promise<{ success: boolean }> =>
    request('/api/settings/consent', 'Update consent', 'POST', data)

  const updateGettingStarted = (completed: boolean): Promise<{ success: boolean }> =>
    request('/api/settings/getting-started', 'Update getting started', 'POST', { completed })

  const resetData = (
    type: 'diary' | 'labValues' | 'ownFood'
  ): Promise<{ success: boolean; type: string }> =>
    request('/api/settings/reset', 'Reset data', 'POST', { type })

  const deleteAccount = (): Promise<{ success: boolean }> =>
    request('/api/settings/delete-account', 'Delete account', 'POST')

  // ============================================================================
  // Community Food Operations
  // ============================================================================

  const voteCommunityFood = (data: {
    communityFoodKey: string
    vote: 1 | -1
  }): Promise<{
    success: boolean
    likes: number
    dislikes: number
    score: number
    hidden: boolean
  }> => request('/api/community-food/vote', 'Vote community food', 'POST', data)

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // Diary
    createDiaryDay,
    addFoodItemToDiary,
    updateDiaryDay,
    updateFoodItemInDiary,
    deleteDiaryDay,
    deleteFoodItemFromDiary,
    // Lab Values
    saveLabValue,
    updateLabValue,
    deleteLabValue,
    // Own Food
    saveOwnFood,
    updateOwnFood,
    deleteOwnFood,
    // Community Food
    voteCommunityFood,
    // Settings
    updateSettings,
    updateConsent,
    updateGettingStarted,
    resetData,
    deleteAccount
  }
}
