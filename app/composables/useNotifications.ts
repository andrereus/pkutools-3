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

// Inline error sinks: an open dialog registers one so error notifications render
// inside the dialog (where the failed action is) instead of as a toast over it.
// A stack handles nested dialogs — the topmost (last opened) wins.
const errorSinks: Array<(message: string) => void> = []

const registerErrorSink = (sink: (message: string) => void): (() => void) => {
  errorSinks.push(sink)
  return () => {
    const index = errorSinks.lastIndexOf(sink)
    if (index !== -1) errorSinks.splice(index, 1)
  }
}

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
  // Clear any pending cleanup first so a second close() (undo emits both 'undo'
  // and 'close', both wired to close) doesn't orphan the previous timeout.
  if (cleanupTimeout) {
    clearTimeout(cleanupTimeout)
  }
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
  // If a dialog is open, show the error inline within it rather than over it.
  const sink = errorSinks[errorSinks.length - 1]
  if (sink) {
    sink(message)
    return
  }
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
    close,
    registerErrorSink
  }
}
