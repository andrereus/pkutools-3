export const useErrorHandler = () => {
  const notifications = useNotifications()

  const handleError = (error: unknown, context?: string) => {
    // Log error in development
    if (import.meta.dev) {
      console.error(`Error${context ? ` in ${context}` : ''}:`, error)
    }

    // Map error codes to user-friendly messages
    let message = 'An unexpected error occurred. Please try again.'

    const httpError = error as {
      statusCode?: number
      data?: { message?: string }
      message?: string
    }

    if (httpError.statusCode) {
      switch (httpError.statusCode) {
        case 400:
          message =
            httpError.data?.message ||
            httpError.message ||
            'Invalid request. Please check your input.'
          break
        case 401:
          message = 'Authentication failed. Please sign in again.'
          break
        case 403:
          message =
            httpError.data?.message ||
            httpError.message ||
            'You do not have permission to perform this action.'
          break
        case 404:
          message = 'The requested resource was not found.'
          break
        case 429:
          message = 'Too many requests. Please try again later.'
          break
        case 500:
          message = 'Server error. Please try again later.'
          break
        default:
          message = httpError.data?.message || httpError.message || message
      }
    } else if (httpError.message) {
      message = httpError.message
    }

    // Show notification
    notifications.error(message)

    // Return error for further handling if needed
    return error
  }

  return {
    handleError
  }
}
