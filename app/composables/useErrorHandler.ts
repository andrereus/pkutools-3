type ZodIssue = {
  code?: string
  path?: Array<string | number>
  message?: string
  origin?: string
  inclusive?: boolean
  format?: string
}

export const useErrorHandler = () => {
  const notifications = useNotifications()
  const { t, te } = useI18n()

  const translateFirebaseAuthError = (code: string): string => {
    // Firebase codes look like "auth/invalid-email". Some legacy/SDK codes
    // include nested segments after a "." or "/" — strip them before lookup.
    const shortCode = code.replace(/^auth\//, '').split(/[./]/)[0]
    const key = `errors.auth.${shortCode}`
    return te(key) ? t(key) : t('errors.auth.default')
  }

  const fieldLabel = (path: ZodIssue['path']): string | null => {
    // Use the deepest string segment of the issue path as the field key
    // (skip numeric array indices like in `log[0].name`).
    const key = [...(path || [])].reverse().find((p) => typeof p === 'string') as
      | string
      | undefined
    if (!key) return null
    const i18nKey = `errors.fields.${key}`
    return te(i18nKey) ? t(i18nKey) : key
  }

  const translateZodIssue = (issue: ZodIssue): string => {
    const field = fieldLabel(issue.path)
    const lastPath = issue.path?.[issue.path.length - 1]
    const isLengthOrigin =
      issue.origin === 'string' || issue.origin === 'array' || issue.origin === 'set'

    // Date fields with regex format get a friendlier dedicated message
    if (issue.code === 'invalid_format' && issue.format === 'regex' && lastPath === 'date') {
      return t('errors.validation.invalid-date')
    }

    let key: string
    switch (issue.code) {
      case 'too_small':
        if (isLengthOrigin) {
          // Empty string / empty array → required
          key = 'errors.validation.required'
        } else if (issue.inclusive === false) {
          key = 'errors.validation.must-be-positive'
        } else {
          key = 'errors.validation.must-be-non-negative'
        }
        break
      case 'too_big':
        // Distinguish length (string/array) from numeric magnitude
        key = isLengthOrigin ? 'errors.validation.too-long' : 'errors.validation.too-large'
        break
      case 'invalid_format':
        key = 'errors.validation.invalid-format'
        break
      default:
        key = 'errors.validation.invalid'
    }

    if (!field) {
      // No identifiable field — fall back to generic "please check your input"
      return t('errors.validation.generic')
    }
    return t(key, { field })
  }

  const buildValidationMessage = (issues: unknown): string => {
    if (!Array.isArray(issues) || issues.length === 0) {
      return t('errors.validation-failed')
    }
    const seen = new Set<string>()
    const parts: string[] = []
    for (const issue of issues as ZodIssue[]) {
      const text = translateZodIssue(issue)
      if (!seen.has(text)) {
        seen.add(text)
        parts.push(text)
      }
    }
    return parts.join(' ')
  }

  const handleError = (error: unknown, context?: string) => {
    // Log error in development
    if (import.meta.dev) {
      console.error(`Error${context ? ` in ${context}` : ''}:`, error)
    }

    // Map error codes to user-friendly messages
    let message = t('errors.unexpected')

    const httpError = error as {
      statusCode?: number
      data?: { message?: string } | unknown
      message?: string
      code?: string
    }

    // Firebase auth errors carry a `code` like "auth/invalid-email"
    if (typeof httpError.code === 'string' && httpError.code.startsWith('auth/')) {
      message = translateFirebaseAuthError(httpError.code)
    } else if (httpError.statusCode) {
      // Nuxt $fetch errors wrap the response body in `httpError.data`, so
      // server-thrown `createError({ message, data })` becomes
      // `httpError.data = { statusCode, message, data }`.
      const body = httpError.data as
        | { message?: string; data?: unknown }
        | undefined
      const bodyMessage = body?.message

      switch (httpError.statusCode) {
        case 400:
          // Server-side Zod validation errors set `data` to the issues array
          // and `message` to "Validation failed: ...". Build a field-specific
          // translated message instead of leaking server-language text.
          if (Array.isArray(body?.data)) {
            message = buildValidationMessage(body.data)
          } else if (
            typeof bodyMessage === 'string' &&
            bodyMessage.startsWith('Validation failed')
          ) {
            message = t('errors.validation-failed')
          } else {
            message = bodyMessage || t('errors.bad-request')
          }
          break
        case 401:
          message = t('errors.unauthorized')
          break
        case 403:
          message = bodyMessage || t('errors.forbidden')
          break
        case 404:
          message = t('errors.not-found')
          break
        case 429:
          message = t('errors.too-many-requests')
          break
        case 500:
          message = t('errors.server')
          break
        default:
          message = bodyMessage || httpError.message || message
      }
    } else if (typeof httpError.message === 'string' && httpError.message.startsWith('Firebase:')) {
      // Firebase error without a parsable code field — fall back to a generic
      // translated auth message rather than showing the raw Firebase string.
      message = t('errors.auth.default')
    }
    // Any other unrecognized error keeps the generic `errors.unexpected`
    // message set above; raw `error.message` is intentionally not surfaced
    // to avoid leaking untranslated developer strings to users. The actual
    // error is still logged via the dev-mode console.error above.

    // Show notification
    notifications.error(message)

    // Return error for further handling if needed
    return error
  }

  return {
    handleError
  }
}
