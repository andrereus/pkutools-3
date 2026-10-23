import { changelogEtag, changelogLatest } from '../../utils/changelog'

export default defineEventHandler((event) => {
  if (handleCacheHeaders(event, { etag: changelogEtag, maxAge: 0 })) return null
  return changelogLatest
})
