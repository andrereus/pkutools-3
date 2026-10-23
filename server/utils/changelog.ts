import { createHash } from 'node:crypto'
import changelog from '../../content/changelog.json'

// The release notes, served by the deployment that ships them, so an app that
// stayed open across a deploy still gets the new ones. The ETag changes with
// the file, so a browser revalidates cheaply and downloads only after a change.

export const changelogEntries = changelog

export const changelogEtag = `"${createHash('sha1')
  .update(JSON.stringify(changelog))
  .digest('hex')
  .slice(0, 16)}"`

/** What the header's dot needs: the newest note's time and revision. */
export const changelogLatest = {
  at: changelog.reduce((latest, entry) => Math.max(latest, Date.parse(entry.publishedAt)), 0),
  revision: changelog.reduce((latest, entry) => Math.max(latest, entry.revision), 0)
}
