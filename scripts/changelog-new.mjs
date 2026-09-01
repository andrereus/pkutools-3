// Adds a release note to content/changelog.json, stamped with the moment you
// run it. Run this as part of publishing the release: `publishedAt` orders and
// displays the note and places it chronologically. The monotonic revision is
// its stable identity and keeps it unread if deployment happens after this time.
//
// Create the entry during publishing so `publishedAt` matches publication.
//
// Usage:
//   pnpm changelog:new
//   pnpm changelog:new -- new "Multiple updates" "Own foods save from every tool."
//
// With no arguments it writes a stub for you to fill in. Categories are the
// three the app renders: new, improved, tip.

import { readFileSync, writeFileSync } from 'node:fs'

const FILE = 'content/changelog.json'
const CATEGORIES = ['new', 'improved', 'tip']
const MAX_TITLE = 120
const MAX_BODY = 600

const [category = 'improved', title = '', body = ''] = process.argv.slice(2)

if (!CATEGORIES.includes(category)) {
  console.error(`Category must be one of: ${CATEGORIES.join(', ')}`)
  console.error(`Usage: pnpm changelog:new -- <category> ["title"] ["text"]`)
  process.exit(1)
}
if (title.length > MAX_TITLE || body.length > MAX_BODY) {
  console.error(`Title must be under ${MAX_TITLE} characters and text under ${MAX_BODY}.`)
  process.exit(1)
}

const entries = JSON.parse(readFileSync(FILE, 'utf8'))

const revision = entries.reduce(
  (highest, entry) =>
    Number.isSafeInteger(entry.revision) && entry.revision > highest ? entry.revision : highest,
  0
)

const entry = {
  revision: revision + 1,
  publishedAt: new Date().toISOString(),
  category,
  // English is the only language a note must have; the others fall back to it,
  // so a note can go out now and be translated whenever.
  en: { title: title || 'TITLE', body: body || 'One short sentence.' }
}

// Newest first, matching how the file already reads and how the page sorts.
entries.unshift(entry)
writeFileSync(FILE, `${JSON.stringify(entries, null, 2)}\n`)

console.log(`Added to ${FILE}:\n`)
console.log(`  r${entry.revision}  ${entry.publishedAt}  [${entry.category}]`)
console.log(`  ${entry.en.title}`)
console.log(`  ${entry.en.body}\n`)
if (!title) {
  console.log('Edit the placeholder text, then commit. It goes live with the deploy.')
} else {
  console.log('It goes live with the deploy.')
}
