import { getAuth } from 'firebase/auth'

export const useApi = () => {
  const errorHandler = useErrorHandler()

  const getAuthToken = async (): Promise<string> => {
    const auth = getAuth()
    const user = auth.currentUser
    if (!user) {
      throw new Error('User not authenticated')
    }
    return await user.getIdToken()
  }

  const saveDiaryEntry = async (data: {
    date?: string
    name: string
    emoji?: string | null
    icon?: string | null
    pheReference?: number | null
    kcalReference?: number | null
    weight: number
    phe: number
    kcal: number
  }): Promise<{ success: boolean; key?: string; updated?: boolean }> => {
    try {
      const token = await getAuthToken()

      const response = await $fetch<{ success: boolean; key: string; updated?: boolean }>(
        '/api/diary/add-food-item',
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
      errorHandler.handleError(error, 'Save diary entry')
      throw error
    }
  }

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

  const saveOwnFood = async (data: {
    name: string
    icon?: string | null
    phe: number
    kcal: number
  }): Promise<{ success: boolean; key?: string }> => {
    try {
      const token = await getAuthToken()

      const response = await $fetch<{ success: boolean; key: string }>('/api/own-food/save', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: data
      })

      return response
    } catch (error: unknown) {
      errorHandler.handleError(error, 'Save own food')
      throw error
    }
  }

  const updateDiaryEntry = async (data: {
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
    }
  }): Promise<{ success: boolean; key?: string }> => {
    try {
      const token = await getAuthToken()

      const response = await $fetch<{ success: boolean; key: string }>(
        '/api/diary/update-log-item',
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
      errorHandler.handleError(error, 'Update diary entry')
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

  const updateOwnFood = async (data: {
    entryKey: string
    name: string
    icon?: string | null
    phe: number
    kcal: number
  }): Promise<{ success: boolean; key?: string }> => {
    try {
      const token = await getAuthToken()

      const response = await $fetch<{ success: boolean; key: string }>('/api/own-food/update', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: {
          entryKey: data.entryKey,
          data: {
            name: data.name,
            icon: data.icon,
            phe: data.phe,
            kcal: data.kcal
          }
        }
      })

      return response
    } catch (error: unknown) {
      errorHandler.handleError(error, 'Update own food')
      throw error
    }
  }

  const deleteDiaryEntry = async (data: {
    entryKey: string
  }): Promise<{ success: boolean; key?: string }> => {
    try {
      const token = await getAuthToken()

      const response = await $fetch<{ success: boolean; key: string }>('/api/diary/delete-entry', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: data
      })

      return response
    } catch (error: unknown) {
      errorHandler.handleError(error, 'Delete diary entry')
      throw error
    }
  }

  const deleteDiaryLogItem = async (data: {
    entryKey: string
    logIndex: number
  }): Promise<{ success: boolean; key?: string; deletedLogIndex?: number }> => {
    try {
      const token = await getAuthToken()

      const response = await $fetch<{ success: boolean; key: string; deletedLogIndex: number }>(
        '/api/diary/delete-log-item',
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
      errorHandler.handleError(error, 'Delete diary log item')
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

  const updateDiaryTotals = async (data: {
    entryKey: string
    date?: string
    phe: number
    kcal: number
    log?: Array<unknown>
  }): Promise<{ success: boolean; key?: string; updated?: boolean }> => {
    try {
      const token = await getAuthToken()

      const response = await $fetch<{ success: boolean; key: string; updated: boolean }>(
        '/api/diary/update-entry',
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
      errorHandler.handleError(error, 'Update diary totals')
      throw error
    }
  }

  const createDayEntry = async (data: {
    date: string
    phe: number
    kcal: number
  }): Promise<{ success: boolean; key?: string }> => {
    try {
      const token = await getAuthToken()

      const response = await $fetch<{ success: boolean; key: string }>('/api/diary/create-entry', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: data
      })

      return response
    } catch (error: unknown) {
      errorHandler.handleError(error, 'Create day entry')
      throw error
    }
  }

  return {
    saveDiaryEntry,
    saveLabValue,
    saveOwnFood,
    updateDiaryEntry,
    updateLabValue,
    updateOwnFood,
    deleteDiaryEntry,
    deleteDiaryLogItem,
    deleteLabValue,
    deleteOwnFood,
    updateSettings,
    resetData,
    deleteAccount,
    updateConsent,
    updateGettingStarted,
    updateDiaryTotals,
    createDayEntry
  }
}
