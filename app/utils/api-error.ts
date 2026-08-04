// Reading a failed request without reporting it. useApi reports every failure
// it sees, which is right when the failure is the whole outcome. These are for
// the cases where it is only part of one — a food that couldn't be saved
// alongside a diary entry that could — and the caller has to fold the reason
// into a single message rather than show two.

/**
 * The stable business-rule code an endpoint attached to an error, e.g.
 * 'limit-reached'. Nuxt's $fetch wraps the response body in `data`, and the
 * endpoints put their code in `data.data.code` — the same place useErrorHandler
 * reads it from. Null for network failures and anything without a code.
 */
export const errorCode = (error: unknown): string | null => {
  const body = (error as { data?: { data?: { code?: string } } } | null)?.data?.data
  return typeof body?.code === 'string' ? body.code : null
}

/**
 * Why a request failed, translated. Falls back to the generic message where
 * there is no code or no translation for it, so the caller always has a
 * sentence to show.
 */
export const failureReason = (
  error: unknown,
  t: (key: string) => string,
  te: (key: string) => boolean
): string => {
  const code = errorCode(error)
  const key = code ? `errors.${code}` : null
  return key && te(key) ? t(key) : t('errors.unexpected')
}
