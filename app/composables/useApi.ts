import { getAuth } from 'firebase/auth'

// Common nutrients per 100 g, at the precision the source publishes them.
// Consumed amounts are derived from `weight` on display, never stored.
export interface FoodNutrients {
  protein?: number | null
  fat?: number | null
  carbs?: number | null
  sugar?: number | null
  fiber?: number | null
  salt?: number | null
}

// Where the values originally came from, mirroring FoodSourceSchema on the server.
// 'own-food' and 'community' are legacy values here — a food picked from either
// list keeps the origin of its values and records the list in `addedFrom`.
export type FoodSource =
  'bls' | 'usda' | 'own-food' | 'community' | 'barcode' | 'ai-estimate' | 'ai-label' | 'manual'

// Which collection a diary entry was taken from, when that is not its values'
// origin
export type AddedFrom = 'own-food' | 'community'

type DiaryItemLocator = { itemId: string; logIndex?: never } | { itemId?: never; logIndex: number }

// Carried by diary entries and own foods alike
interface Provenance {
  nutrients?: FoodNutrients | null
  // Original calculation metadata. A material edit can make it historical
  // rather than a formula for the current Phe value.
  factor?: number | null
  source?: FoodSource | null
  sourceId?: string | null // barcode / BLS id / USDA id, within `source`
  materiallyEdited?: boolean
}

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
  //
  // `silent` leaves the reporting to the caller. It is for the requests whose
  // failure is only part of an outcome — an own food that couldn't be saved
  // next to a diary entry that could — where the handler's own notification
  // would be replaced moments later by the one that tells the whole story.
  const request = async <T>(
    url: string,
    label: string,
    method: 'POST' | 'PUT' | 'DELETE',
    body?: unknown,
    options?: { silent?: boolean }
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
      if (!options?.silent) errorHandler.handleError(error, label)
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
    createdAt?: number // Only for undo-restore: preserves the original timestamps
    updatedAt?: number
  }): Promise<{ success: boolean; key?: string }> =>
    request('/api/diary/days', 'Create diary day', 'POST', data)

  const addFoodItemToDiary = (
    data: Provenance & {
      itemId?: string
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
      addedFrom?: AddedFrom | null // Set when the entry was picked from a list
      communityFoodKey?: string | null // Optional: tracks usage count and stored in diary entry
      createdAt?: number // Only for undo-restore: preserves the original timestamps
      updatedAt?: number
    }
  ): Promise<{ success: boolean; key?: string; updated?: boolean }> =>
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

  const updateFoodItemInDiary = (
    data: DiaryItemLocator & {
      entryKey: string
      entry: Provenance & {
        itemId?: string
        name: string
        emoji?: string | null
        icon?: string | null
        pheReference?: number | null
        kcalReference?: number | null
        weight: number
        phe: number
        kcal: number
        note?: string | null
        addedFrom?: AddedFrom | null
      }
    }
  ): Promise<{ success: boolean; key?: string }> =>
    request(`/api/diary/food-items/${data.entryKey}`, 'Update food item in diary', 'PUT', {
      ...(data.itemId ? { itemId: data.itemId } : { logIndex: data.logIndex }),
      entry: data.entry
    })

  const deleteDiaryDay = (entryKey: string): Promise<{ success: boolean; key?: string }> =>
    request(`/api/diary/days/${entryKey}`, 'Delete diary day', 'DELETE')

  const deleteFoodItemFromDiary = (
    data: DiaryItemLocator & { entryKey: string }
  ): Promise<{ success: boolean; key?: string; deletedLogIndex?: number }> =>
    request(`/api/diary/food-items/${data.entryKey}`, 'Delete food item from diary', 'DELETE', {
      ...(data.itemId ? { itemId: data.itemId } : { logIndex: data.logIndex })
    })

  // ============================================================================
  // Lab Values Operations
  // ============================================================================

  const saveLabValue = (data: {
    date: string
    phe?: number | null
    tyrosine?: number | null
    createdAt?: number // Only for undo-restore: preserves the original timestamps
    updatedAt?: number
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

  const saveOwnFood = (
    data: Provenance & {
      name: string
      icon?: string | null
      emoji?: string | null
      phe: number
      kcal: number
      note?: string | null
      shared?: boolean
      createdAt?: number // Only for undo-restore: preserves the original timestamps
      updatedAt?: number
    },
    options?: { silent?: boolean }
  ): Promise<{
    success: boolean
    key?: string
    communityKey?: string
    // Set when the food was recognised by its source id (a rescanned product):
    // the stored entry is returned untouched and nothing was written
    alreadyExists?: boolean
  }> =>
    request(
      '/api/own-food/save',
      'Save own food',
      'POST',
      { ...data, locale: locale.value },
      options
    )

  const updateOwnFood = (
    data: Pick<Provenance, 'nutrients'> & {
      entryKey: string
      name: string
      icon?: string | null
      emoji?: string | null
      phe: number
      kcal: number
      note?: string | null
      shared?: boolean
    }
  ): Promise<{ success: boolean; key?: string; communityKey?: string | null }> =>
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
        shared: data.shared,
        // Nutrients are editable content. Original provenance and the material
        // edit flag are preserved/derived by the server and cannot be reset by
        // a stale client.
        ...(data.nutrients !== undefined && { nutrients: data.nutrients })
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
    preferredTool?: 'food-search' | 'barcode-scanner' | 'ai-calculator' | 'phe-calculator'
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
