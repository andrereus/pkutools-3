export interface NotificationOptions {
  message: string
  type?: 'info' | 'success' | 'error' | 'warning'
  undoAction?: () => void
  undoLabel?: string
}

// Singleton state for notifications
const notification = ref<NotificationOptions | null>(null)
const showNotification = ref(false)
let cleanupTimeout: ReturnType<typeof setTimeout> | null = null

const notify = (options: NotificationOptions) => {
  // Cancel any pending cleanup timeout from a previous notification closing
  if (cleanupTimeout) {
    clearTimeout(cleanupTimeout)
    cleanupTimeout = null
  }

  // Update notification content - the component's watch will detect the change and reset the timer
  notification.value = {
    type: 'info',
    ...options
  }
  showNotification.value = true
}

const close = () => {
  showNotification.value = false
  // Clear notification after animation
  cleanupTimeout = setTimeout(() => {
    notification.value = null
    cleanupTimeout = null
  }, 300)
}

const success = (message: string, options?: Omit<NotificationOptions, 'message' | 'type'>) => {
  notify({ ...options, message, type: 'success' })
}

const error = (message: string, options?: Omit<NotificationOptions, 'message' | 'type'>) => {
  notify({ ...options, message, type: 'error' })
}

const warning = (message: string, options?: Omit<NotificationOptions, 'message' | 'type'>) => {
  notify({ ...options, message, type: 'warning' })
}

const info = (message: string, options?: Omit<NotificationOptions, 'message' | 'type'>) => {
  notify({ ...options, message, type: 'info' })
}

export const useNotifications = () => {
  return {
    notification: readonly(notification),
    showNotification: readonly(showNotification),
    notify,
    success,
    error,
    warning,
    info,
    close
  }
}
