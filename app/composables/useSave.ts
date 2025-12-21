import { getAuth } from 'firebase/auth'

export const useSave = () => {
  const notifications = useNotifications()

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
        '/api/diary/save',
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
      console.error('Save diary entry error:', error)

      const httpError = error as { statusCode?: number; data?: { message?: string } }
      if (httpError.statusCode === 403) {
        notifications.error(
          httpError.data?.message ||
            'Diary limit reached. Upgrade to premium for unlimited entries.'
        )
      } else if (httpError.statusCode === 400) {
        // Show detailed validation error if available
        const errorMessage = httpError.data?.message || 'Invalid data. Please check your input.'
        notifications.error(errorMessage)
      } else if (httpError.statusCode === 401) {
        notifications.error('Authentication failed. Please sign in again.')
      } else {
        notifications.error('Failed to save diary entry. Please try again.')
      }

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
      console.error('Save lab value error:', error)

      const httpError = error as { statusCode?: number; data?: { message?: string } }
      if (httpError.statusCode === 400) {
        const errorMessage = httpError.data?.message || 'Invalid data. Please check your input.'
        notifications.error(errorMessage)
      } else if (httpError.statusCode === 401) {
        notifications.error('Authentication failed. Please sign in again.')
      } else {
        notifications.error('Failed to save lab value. Please try again.')
      }

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
      console.error('Save own food error:', error)

      const httpError = error as { statusCode?: number; data?: { message?: string } }
      if (httpError.statusCode === 400) {
        const errorMessage = httpError.data?.message || 'Invalid data. Please check your input.'
        notifications.error(errorMessage)
      } else if (httpError.statusCode === 401) {
        notifications.error('Authentication failed. Please sign in again.')
      } else {
        notifications.error('Failed to save custom food. Please try again.')
      }

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

      const response = await $fetch<{ success: boolean; key: string }>('/api/diary/update', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: data
      })

      return response
    } catch (error: unknown) {
      console.error('Update diary entry error:', error)

      const httpError = error as { statusCode?: number; data?: { message?: string } }
      if (httpError.statusCode === 400) {
        const errorMessage = httpError.data?.message || 'Invalid data. Please check your input.'
        notifications.error(errorMessage)
      } else if (httpError.statusCode === 401) {
        notifications.error('Authentication failed. Please sign in again.')
      } else if (httpError.statusCode === 404) {
        notifications.error('Entry not found.')
      } else {
        notifications.error('Failed to update diary entry. Please try again.')
      }

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
      console.error('Update lab value error:', error)

      const httpError = error as { statusCode?: number; data?: { message?: string } }
      if (httpError.statusCode === 400) {
        const errorMessage = httpError.data?.message || 'Invalid data. Please check your input.'
        notifications.error(errorMessage)
      } else if (httpError.statusCode === 401) {
        notifications.error('Authentication failed. Please sign in again.')
      } else if (httpError.statusCode === 404) {
        notifications.error('Entry not found.')
      } else {
        notifications.error('Failed to update lab value. Please try again.')
      }

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
      console.error('Update own food error:', error)

      const httpError = error as { statusCode?: number; data?: { message?: string } }
      if (httpError.statusCode === 400) {
        const errorMessage = httpError.data?.message || 'Invalid data. Please check your input.'
        notifications.error(errorMessage)
      } else if (httpError.statusCode === 401) {
        notifications.error('Authentication failed. Please sign in again.')
      } else if (httpError.statusCode === 404) {
        notifications.error('Entry not found.')
      } else {
        notifications.error('Failed to update custom food. Please try again.')
      }

      throw error
    }
  }

  const deleteDiaryEntry = async (data: {
    entryKey: string
  }): Promise<{ success: boolean; key?: string }> => {
    try {
      const token = await getAuthToken()

      const response = await $fetch<{ success: boolean; key: string }>('/api/diary/delete', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: data
      })

      return response
    } catch (error: unknown) {
      console.error('Delete diary entry error:', error)

      const httpError = error as { statusCode?: number; data?: { message?: string } }
      if (httpError.statusCode === 401) {
        notifications.error('Authentication failed. Please sign in again.')
      } else if (httpError.statusCode === 404) {
        notifications.error('Diary entry not found.')
      } else {
        notifications.error('Failed to delete diary entry. Please try again.')
      }

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
      console.error('Delete diary log item error:', error)

      const httpError = error as { statusCode?: number; data?: { message?: string } }
      if (httpError.statusCode === 401) {
        notifications.error('Authentication failed. Please sign in again.')
      } else if (httpError.statusCode === 404) {
        notifications.error('Diary entry not found.')
      } else {
        notifications.error('Failed to delete diary item. Please try again.')
      }

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
      console.error('Delete lab value error:', error)

      const httpError = error as { statusCode?: number; data?: { message?: string } }
      if (httpError.statusCode === 401) {
        notifications.error('Authentication failed. Please sign in again.')
      } else if (httpError.statusCode === 404) {
        notifications.error('Lab value entry not found.')
      } else {
        notifications.error('Failed to delete lab value. Please try again.')
      }

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
      console.error('Delete own food error:', error)

      const httpError = error as { statusCode?: number; data?: { message?: string } }
      if (httpError.statusCode === 401) {
        notifications.error('Authentication failed. Please sign in again.')
      } else if (httpError.statusCode === 404) {
        notifications.error('Custom food entry not found.')
      } else {
        notifications.error('Failed to delete custom food. Please try again.')
      }

      throw error
    }
  }

  const updateSettings = async (data: {
    maxPhe?: number | null
    maxKcal?: number | null
    labUnit?: 'mgdl' | 'umoll'
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
      console.error('Update settings error:', error)

      const httpError = error as { statusCode?: number; data?: { message?: string } }
      if (httpError.statusCode === 400) {
        const errorMessage = httpError.data?.message || 'Invalid data. Please check your input.'
        notifications.error(errorMessage)
      } else if (httpError.statusCode === 401) {
        notifications.error('Authentication failed. Please sign in again.')
      } else {
        notifications.error('Failed to update settings. Please try again.')
      }

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
      console.error('Reset data error:', error)

      const httpError = error as { statusCode?: number; data?: { message?: string } }
      if (httpError.statusCode === 401) {
        notifications.error('Authentication failed. Please sign in again.')
      } else {
        notifications.error('Failed to reset data. Please try again.')
      }

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
      console.error('Delete account error:', error)

      const httpError = error as { statusCode?: number; data?: { message?: string } }
      if (httpError.statusCode === 401) {
        notifications.error('Authentication failed. Please sign in again.')
      } else {
        notifications.error('Failed to delete account. Please try again.')
      }

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
      console.error('Update consent error:', error)

      const httpError = error as { statusCode?: number; data?: { message?: string } }
      if (httpError.statusCode === 401) {
        notifications.error('Authentication failed. Please sign in again.')
      } else {
        notifications.error('Failed to update consent. Please try again.')
      }

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
      console.error('Update getting started error:', error)

      const httpError = error as { statusCode?: number; data?: { message?: string } }
      if (httpError.statusCode === 401) {
        notifications.error('Authentication failed. Please sign in again.')
      } else {
        notifications.error('Failed to update getting started status. Please try again.')
      }

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
        '/api/diary/update-totals',
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
      console.error('Update diary totals error:', error)

      const httpError = error as { statusCode?: number; data?: { message?: string } }
      if (httpError.statusCode === 400) {
        const errorMessage = httpError.data?.message || 'Invalid data. Please check your input.'
        notifications.error(errorMessage)
      } else if (httpError.statusCode === 401) {
        notifications.error('Authentication failed. Please sign in again.')
      } else if (httpError.statusCode === 404) {
        notifications.error('Diary entry not found.')
      } else {
        notifications.error('Failed to update diary totals. Please try again.')
      }

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

      const response = await $fetch<{ success: boolean; key: string }>('/api/diary/create-day', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: data
      })

      return response
    } catch (error: unknown) {
      console.error('Create day entry error:', error)

      const httpError = error as { statusCode?: number; data?: { message?: string } }
      if (httpError.statusCode === 403) {
        notifications.error(
          httpError.data?.message ||
            'Diary limit reached. Upgrade to premium for unlimited entries.'
        )
      } else if (httpError.statusCode === 400) {
        const errorMessage = httpError.data?.message || 'Invalid data. Please check your input.'
        notifications.error(errorMessage)
      } else if (httpError.statusCode === 401) {
        notifications.error('Authentication failed. Please sign in again.')
      } else {
        notifications.error('Failed to create day entry. Please try again.')
      }

      throw error
    }
  }

  const addLogItemToEntry = async (data: {
    entryKey: string
    logItem: {
      name: string
      emoji?: string | null
      icon?: string | null
      pheReference?: number | null
      kcalReference?: number | null
      weight: number
      phe: number
      kcal: number
    }
  }): Promise<{ success: boolean; key?: string; updated?: boolean }> => {
    try {
      const token = await getAuthToken()

      const response = await $fetch<{ success: boolean; key: string; updated: boolean }>(
        '/api/diary/add-log-item',
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
      console.error('Add log item error:', error)

      const httpError = error as { statusCode?: number; data?: { message?: string } }
      if (httpError.statusCode === 400) {
        const errorMessage = httpError.data?.message || 'Invalid data. Please check your input.'
        notifications.error(errorMessage)
      } else if (httpError.statusCode === 401) {
        notifications.error('Authentication failed. Please sign in again.')
      } else if (httpError.statusCode === 404) {
        notifications.error('Diary entry not found.')
      } else {
        notifications.error('Failed to add log item. Please try again.')
      }

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
    createDayEntry,
    addLogItemToEntry
  }
}
