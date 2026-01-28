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

  // ============================================================================
  // Diary Operations
  // ============================================================================

  const createDiaryDay = async (data: {
    date: string
    phe: number
    kcal: number
  }): Promise<{ success: boolean; key?: string }> => {
    try {
      const token = await getAuthToken()

      const response = await $fetch<{ success: boolean; key: string }>('/api/diary/days', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: data
      })

      return response
    } catch (error: unknown) {
      errorHandler.handleError(error, 'Create diary day')
      throw error
    }
  }

  const addFoodItemToDiary = async (data: {
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
  }): Promise<{ success: boolean; key?: string; updated?: boolean }> => {
    try {
      const token = await getAuthToken()

      const response = await $fetch<{ success: boolean; key: string; updated?: boolean }>(
        '/api/diary/food-items',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`
          },
          body: data
        }
      )

      return response
    } catch (error: unknown) {
      errorHandler.handleError(error, 'Add food item to diary')
      throw error
    }
  }

  const updateDiaryDay = async (data: {
    entryKey: string
    date?: string
    phe: number
    kcal: number
    log?: Array<unknown>
  }): Promise<{ success: boolean; key?: string; updated?: boolean }> => {
    try {
      const token = await getAuthToken()

      const response = await $fetch<{ success: boolean; key: string; updated: boolean }>(
        `/api/diary/days/${data.entryKey}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`
          },
          body: {
            date: data.date,
            phe: data.phe,
            kcal: data.kcal,
            log: data.log
          }
        }
      )

      return response
    } catch (error: unknown) {
      errorHandler.handleError(error, 'Update diary day')
      throw error
    }
  }

  const updateFoodItemInDiary = async (data: {
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
  }): Promise<{ success: boolean; key?: string }> => {
    try {
      const token = await getAuthToken()

      const response = await $fetch<{ success: boolean; key: string }>(
        `/api/diary/food-items/${data.entryKey}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`
          },
          body: {
            logIndex: data.logIndex,
            entry: data.entry
          }
        }
      )

      return response
    } catch (error: unknown) {
      errorHandler.handleError(error, 'Update food item in diary')
      throw error
    }
  }

  const deleteDiaryDay = async (entryKey: string): Promise<{ success: boolean; key?: string }> => {
    try {
      const token = await getAuthToken()

      const response = await $fetch<{ success: boolean; key: string }>(
        `/api/diary/days/${entryKey}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      )

      return response
    } catch (error: unknown) {
      errorHandler.handleError(error, 'Delete diary day')
      throw error
    }
  }

  const deleteFoodItemFromDiary = async (data: {
    entryKey: string
    logIndex: number
  }): Promise<{ success: boolean; key?: string; deletedLogIndex?: number }> => {
    try {
      const token = await getAuthToken()

      const response = await $fetch<{ success: boolean; key: string; deletedLogIndex: number }>(
        `/api/diary/food-items/${data.entryKey}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`
          },
          body: {
            logIndex: data.logIndex
          }
        }
      )

      return response
    } catch (error: unknown) {
      errorHandler.handleError(error, 'Delete food item from diary')
      throw error
    }
  }

  // ============================================================================
  // Lab Values Operations
  // ============================================================================

  const saveLabValue = async (data: {
    date: string
    phe?: number | null
    tyrosine?: number | null
  }): Promise<{ success: boolean; key?: string }> => {
    try {
      const token = await getAuthToken()

      const response = await $fetch<{ success: boolean; key: string }>('/api/lab-values/save', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: data
      })

      return response
    } catch (error: unknown) {
      errorHandler.handleError(error, 'Save lab value')
      throw error
    }
  }

  const updateLabValue = async (data: {
    entryKey: string
    date: string
    phe?: number | null
    tyrosine?: number | null
  }): Promise<{ success: boolean; key?: string }> => {
    try {
      const token = await getAuthToken()

      const response = await $fetch<{ success: boolean; key: string }>('/api/lab-values/update', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: {
          entryKey: data.entryKey,
          data: {
            date: data.date,
            phe: data.phe,
            tyrosine: data.tyrosine
          }
        }
      })

      return response
    } catch (error: unknown) {
      errorHandler.handleError(error, 'Update lab value')
      throw error
    }
  }

  const deleteLabValue = async (data: {
    entryKey: string
  }): Promise<{ success: boolean; key?: string }> => {
    try {
      const token = await getAuthToken()

      const response = await $fetch<{ success: boolean; key: string }>('/api/lab-values/delete', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: data
      })

      return response
    } catch (error: unknown) {
      errorHandler.handleError(error, 'Delete lab value')
      throw error
    }
  }

  // ============================================================================
  // Own Food Operations
  // ============================================================================

  const saveOwnFood = async (data: {
    name: string
    icon?: string | null
    phe: number
    kcal: number
    note?: string | null
    shared?: boolean
  }): Promise<{ success: boolean; key?: string; communityKey?: string }> => {
    try {
      const token = await getAuthToken()

      const response = await $fetch<{ success: boolean; key: string; communityKey?: string }>(
        '/api/own-food/save',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`
          },
          body: {
            ...data,
            locale: locale.value
          }
        }
      )

      return response
    } catch (error: unknown) {
      errorHandler.handleError(error, 'Save own food')
      throw error
    }
  }

  const updateOwnFood = async (data: {
    entryKey: string
    name: string
    icon?: string | null
    phe: number
    kcal: number
    note?: string | null
    shared?: boolean
  }): Promise<{ success: boolean; key?: string; communityKey?: string | null }> => {
    try {
      const token = await getAuthToken()

      const response = await $fetch<{
        success: boolean
        key: string
        communityKey?: string | null
      }>('/api/own-food/update', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: {
          entryKey: data.entryKey,
          locale: locale.value,
          data: {
            name: data.name,
            icon: data.icon,
            phe: data.phe,
            note: data.note,
            kcal: data.kcal,
            shared: data.shared
          }
        }
      })

      return response
    } catch (error: unknown) {
      errorHandler.handleError(error, 'Update own food')
      throw error
    }
  }

  const deleteOwnFood = async (data: {
    entryKey: string
  }): Promise<{ success: boolean; key?: string }> => {
    try {
      const token = await getAuthToken()

      const response = await $fetch<{ success: boolean; key: string }>('/api/own-food/delete', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: data
      })

      return response
    } catch (error: unknown) {
      errorHandler.handleError(error, 'Delete own food')
      throw error
    }
  }

  // ============================================================================
  // Settings Operations
  // ============================================================================

  const updateSettings = async (data: {
    maxPhe?: number | null
    maxKcal?: number | null
    labUnit?: 'mgdl' | 'umoll'
    license?: string | null
  }): Promise<{ success: boolean }> => {
    try {
      const token = await getAuthToken()

      const response = await $fetch<{ success: boolean }>('/api/settings/update', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: data
      })

      return response
    } catch (error: unknown) {
      errorHandler.handleError(error, 'Update settings')
      throw error
    }
  }

  const updateConsent = async (data: {
    healthDataConsent?: boolean
    emailConsent?: boolean
  }): Promise<{ success: boolean }> => {
    try {
      const token = await getAuthToken()

      const response = await $fetch<{ success: boolean }>('/api/settings/consent', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: data
      })

      return response
    } catch (error: unknown) {
      errorHandler.handleError(error, 'Update consent')
      throw error
    }
  }

  const updateGettingStarted = async (completed: boolean): Promise<{ success: boolean }> => {
    try {
      const token = await getAuthToken()

      const response = await $fetch<{ success: boolean }>('/api/settings/getting-started', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: { completed }
      })

      return response
    } catch (error: unknown) {
      errorHandler.handleError(error, 'Update getting started')
      throw error
    }
  }

  const resetData = async (
    type: 'diary' | 'labValues' | 'ownFood'
  ): Promise<{ success: boolean; type: string }> => {
    try {
      const token = await getAuthToken()

      const response = await $fetch<{ success: boolean; type: string }>('/api/settings/reset', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: { type }
      })

      return response
    } catch (error: unknown) {
      errorHandler.handleError(error, 'Reset data')
      throw error
    }
  }

  const deleteAccount = async (): Promise<{ success: boolean }> => {
    try {
      const token = await getAuthToken()

      const response = await $fetch<{ success: boolean }>('/api/settings/delete-account', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      return response
    } catch (error: unknown) {
      errorHandler.handleError(error, 'Delete account')
      throw error
    }
  }

  // ============================================================================
  // Community Food Operations
  // ============================================================================

  const voteCommunityFood = async (data: {
    communityFoodKey: string
    vote: 1 | -1
  }): Promise<{
    success: boolean
    likes: number
    dislikes: number
    score: number
    hidden: boolean
  }> => {
    try {
      const token = await getAuthToken()

      const response = await $fetch<{
        success: boolean
        likes: number
        dislikes: number
        score: number
        hidden: boolean
      }>('/api/community-food/vote', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: data
      })

      return response
    } catch (error: unknown) {
      errorHandler.handleError(error, 'Vote community food')
      throw error
    }
  }

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
