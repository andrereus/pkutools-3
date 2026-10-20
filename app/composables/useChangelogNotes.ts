import type { ChangelogEntry } from './useNews'

// The release notes, loaded once after the page that needs them has appeared
// rather than with it. News imports them directly; the diary lists them per
// day and should not wait for them.

const notes = shallowRef<ChangelogEntry[]>([])
let loading: Promise<void> | null = null

export const useChangelogNotes = () => {
  if (import.meta.client && !loading) {
    loading = import('../../content/changelog.json')
      .then((module) => {
        notes.value = module.default as ChangelogEntry[]
      })
      .catch(() => {
        // Offline or a failed chunk: the next page that asks tries again.
        loading = null
      })
  }
  return notes
}
