import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

// A missing translation key doesn't crash the app — vue-i18n falls back to
// printing the raw key, so `settings.max-phe` ships to a German user and nobody
// notices until a screenshot shows up. These tests make that a failing build.

const LOCALES = ['en', 'de', 'es', 'fr'] as const
const BASE_LOCALE = 'en'
const root = resolve(__dirname, '..')

type Messages = Record<string, unknown>

const load = (locale: string): Messages =>
  JSON.parse(readFileSync(join(root, 'i18n/locales', `${locale}.json`), 'utf8'))

/** Flattens nested messages into dotted keys, matching how the app calls t(). */
const flatten = (obj: Messages, prefix = ''): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(out, flatten(value as Messages, path))
    } else {
      out[path] = value as string
    }
  }
  return out
}

const messages = Object.fromEntries(LOCALES.map((l) => [l, flatten(load(l))])) as Record<
  string,
  Record<string, string>
>

/** `{name}`-style interpolation placeholders used in a message. */
const placeholders = (value: string) =>
  Array.from(new Set([...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))).sort()

describe('locale files', () => {
  it('all four locales are present and non-trivial', () => {
    for (const locale of LOCALES) {
      expect(Object.keys(messages[locale]!).length).toBeGreaterThan(500)
    }
  })

  it.each(LOCALES.filter((l) => l !== BASE_LOCALE))('%s has exactly the English keys', (locale) => {
    const base = Object.keys(messages[BASE_LOCALE]!).sort()
    const other = Object.keys(messages[locale]!).sort()

    const missing = base.filter((k) => !other.includes(k))
    const extra = other.filter((k) => !base.includes(k))

    expect(missing, `${locale}.json is missing keys`).toEqual([])
    expect(extra, `${locale}.json has keys English does not`).toEqual([])
  })

  it.each(LOCALES)('%s has a non-empty string for every message', (locale) => {
    const blank = Object.entries(messages[locale]!)
      .filter(([, value]) => typeof value !== 'string' || value.trim() === '')
      .map(([key]) => key)

    expect(blank, `${locale}.json has blank or non-string messages`).toEqual([])
  })

  // A translation that drops {field} renders a sentence with a hole in it; one
  // that invents a placeholder renders the literal braces.
  it.each(LOCALES.filter((l) => l !== BASE_LOCALE))(
    '%s uses the same interpolation placeholders as English',
    (locale) => {
      const mismatches: string[] = []
      for (const [key, englishValue] of Object.entries(messages[BASE_LOCALE]!)) {
        const translated = messages[locale]![key]
        if (typeof translated !== 'string' || typeof englishValue !== 'string') continue
        const expected = placeholders(englishValue)
        const actual = placeholders(translated)
        if (expected.join(',') !== actual.join(',')) {
          mismatches.push(
            `${key}: expected {${expected.join('}, {')}}, got {${actual.join('}, {')}}`
          )
        }
      }
      expect(mismatches).toEqual([])
    }
  )
})

describe('translation keys used in the app', () => {
  // Only literal keys are collected; keys built at runtime (t(someVariable), or
  // a template literal with an interpolation) stay the caller's responsibility.
  // All three quote styles count — Prettier normalizes to single quotes, but
  // lines marked `prettier-ignore` keep whatever the author wrote.
  const KEY_CALL = /(?<![\w$.])\$?t\(\s*(['"`])([^'"`]+)\1/g
  const SOURCE_EXTENSIONS = ['.vue', '.ts', '.js']

  const sourceFiles = (dir: string): string[] => {
    const entries = readdirSync(dir)
    return entries.flatMap((entry) => {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) return sourceFiles(full)
      return SOURCE_EXTENSIONS.some((ext) => entry.endsWith(ext)) ? [full] : []
    })
  }

  const usedKeys = new Map<string, string[]>()
  for (const file of sourceFiles(join(root, 'app'))) {
    const contents = readFileSync(file, 'utf8')
    for (const match of contents.matchAll(KEY_CALL)) {
      const key = match[2]!
      if (key.includes('${')) continue
      usedKeys.set(key, [...(usedKeys.get(key) ?? []), file.replace(`${root}/`, '')])
    }
  }

  // Load-bearing: if the regex ever stops matching, the check below finds no
  // missing keys and passes without having verified anything.
  it('finds translation calls to check', () => {
    expect(usedKeys.size).toBeGreaterThan(300)
  })

  it.each(LOCALES)('%s defines every key the app asks for', (locale) => {
    const missing = [...usedKeys.entries()]
      .filter(([key]) => !(key in messages[locale]!))
      .map(([key, files]) => `${key} (used in ${files[0]})`)

    expect(missing).toEqual([])
  })
})
