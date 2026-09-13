import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runInNewContext } from 'node:vm'
import { computed, ref, type Ref } from 'vue'
import {
  ACCENT_COLORS,
  ACCENT_COLOR_STORAGE_KEY,
  RANDOM_ACCENT_STORAGE_KEY,
  accentColorInitScript
} from '../shared/utils/accent-color'
import { useAccentColor } from '../app/composables/useAccentColor'
import { readThemeChartPalette } from '../app/utils/theme-colors'

vi.mock('../app/utils/theme-colors', () => ({ readThemeChartPalette: vi.fn() }))

// CSS resolution is covered by browser checks. Distinct fixtures here verify
// that all consumers update from the resolved palette, rather than a hex table.
const resolvedPalette = (color: string, dark: boolean) => ({
  primary: `${color}-${dark ? 'dark' : 'light'}-primary`,
  strong: `${color}-strong`,
  secondary: `${dark ? 'dark' : 'light'}-secondary`
})

let attributes: Map<string, string>
let stored: Map<string, string>
let states: Map<string, Ref>
let mounted: (() => void)[]
let modeChanged: (() => void)[]
let documentStub: {
  documentElement: {
    getAttribute: ReturnType<typeof vi.fn>
    setAttribute: ReturnType<typeof vi.fn>
    classList: { contains: (name: string) => boolean }
  }
}
let storageStub: {
  getItem: ReturnType<typeof vi.fn>
  setItem: ReturnType<typeof vi.fn>
  removeItem: ReturnType<typeof vi.fn>
}

beforeEach(() => {
  attributes = new Map([['class', 'dark']])
  vi.mocked(readThemeChartPalette).mockImplementation(() =>
    resolvedPalette(attributes.get('data-accent') ?? 'sky', attributes.get('class') === 'dark')
  )
  stored = new Map()
  states = new Map()
  mounted = []
  modeChanged = []
  documentStub = {
    documentElement: {
      getAttribute: vi.fn((key: string) => attributes.get(key) ?? null),
      setAttribute: vi.fn((key: string, value: string) => attributes.set(key, value)),
      classList: {
        contains: (name: string) => attributes.get('class')?.split(' ').includes(name) ?? false
      }
    }
  }
  storageStub = {
    getItem: vi.fn((key: string) => stored.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => stored.set(key, value)),
    removeItem: vi.fn((key: string) => stored.delete(key))
  }
  vi.stubGlobal('document', documentStub)
  vi.stubGlobal('localStorage', storageStub)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('onMounted', (callback: () => void) => mounted.push(callback))
  vi.stubGlobal('onUnmounted', vi.fn())
  vi.stubGlobal(
    'MutationObserver',
    class {
      constructor(callback: () => void) {
        modeChanged.push(callback)
      }
      observe() {}
      disconnect() {}
    }
  )
  vi.stubGlobal('useState', (key: string, init: () => unknown) => {
    if (!states.has(key)) states.set(key, ref(init()))
    return states.get(key)
  })
})

afterEach(() => vi.unstubAllGlobals())

const initialize = () =>
  runInNewContext(accentColorInitScript, { document: documentStub, localStorage: storageStub })

describe('accent preference before hydration', () => {
  it.each(ACCENT_COLORS)(
    'restores %s before the app mounts without changing dark mode',
    (color) => {
      stored.set(ACCENT_COLOR_STORAGE_KEY, color)
      initialize()
      expect(attributes.get('data-accent')).toBe(color)
      expect(attributes.get('class')).toBe('dark')
    }
  )

  it.each([null, '', 'unknown', 'toString'])('falls back to sky for stored value %s', (color) => {
    if (color !== null) stored.set(ACCENT_COLOR_STORAGE_KEY, color)
    initialize()
    expect(attributes.get('data-accent')).toBe('sky')
  })

  it('does not interrupt startup when browser storage is blocked', () => {
    storageStub.getItem.mockImplementation(() => {
      throw new Error('Storage is unavailable')
    })
    expect(initialize).not.toThrow()
    expect(attributes.get('class')).toBe('dark')
  })

  it('rolls a fresh color on every start, never repeating the last one', () => {
    stored.set(ACCENT_COLOR_STORAGE_KEY, 'violet')
    stored.set(RANDOM_ACCENT_STORAGE_KEY, 'true')
    const seen = new Set<string>()
    for (let start = 0; start < 20; start++) {
      const previous = stored.get(ACCENT_COLOR_STORAGE_KEY)
      initialize()
      const color = attributes.get('data-accent')!
      expect(ACCENT_COLORS).toContain(color)
      expect(color).not.toBe(previous)
      expect(stored.get(ACCENT_COLOR_STORAGE_KEY)).toBe(color)
      seen.add(color)
    }
    expect(seen.size).toBeGreaterThan(1)
  })

  it('applies a usable color when the script predates the stored preference', () => {
    stored.set(ACCENT_COLOR_STORAGE_KEY, 'teal')
    stored.set(RANDOM_ACCENT_STORAGE_KEY, 'unsupported-future-value')
    initialize()
    expect(attributes.get('data-accent')).toBe('teal')
  })
})

describe('accent selection', () => {
  it('reads default Sky chart roles from CSS and refreshes them on a mode change', () => {
    const { accentPalette } = useAccentColor()
    expect(accentPalette.value).toEqual(resolvedPalette('sky', true))
    mounted.forEach((callback) => callback())
    expect(accentPalette.value).toEqual(resolvedPalette('sky', true))
    attributes.set('class', '')
    modeChanged.forEach((callback) => callback())
    expect(accentPalette.value).toEqual(resolvedPalette('sky', false))
  })

  it('hydrates with the default, then restores the saved choice for the picker and charts', () => {
    stored.set('accent_color', 'violet')
    initialize()
    const picker = useAccentColor()
    const chart = useAccentColor()
    expect(picker.accentPreference.value).toBe('sky')
    mounted.forEach((callback) => callback())
    expect(picker.accentPreference.value).toBe('violet')
    expect(chart.accentPalette.value.primary).toBe(resolvedPalette('violet', true).primary)

    attributes.set('class', '')
    modeChanged.forEach((callback) => callback())
    expect(chart.accentPalette.value.primary).toBe(resolvedPalette('violet', false).primary)
  })

  it('applies a choice immediately, updates charts, persists across reload and can reset to sky', () => {
    const picker = useAccentColor()
    const chart = useAccentColor()
    picker.accentPreference.value = 'red'
    expect(attributes.get('data-accent')).toBe('red')
    expect(chart.accentPalette.value).toEqual(resolvedPalette('red', true))
    expect(stored.get('accent_color')).toBe('red')

    attributes.delete('data-accent')
    states.clear()
    initialize()
    const reloaded = useAccentColor()
    mounted.at(-1)!()
    expect(reloaded.accentColor.value).toBe('red')
    expect(reloaded.accentPalette.value.primary).toBe(resolvedPalette('red', true).primary)
    reloaded.accentPreference.value = 'sky'
    expect(attributes.get('data-accent')).toBe('sky')
    expect(stored.has(RANDOM_ACCENT_STORAGE_KEY)).toBe(false)
    expect(stored.get(ACCENT_COLOR_STORAGE_KEY)).toBe('sky')
    expect(attributes.get('class')).toBe('dark')
  })

  it('still applies a choice when persistence fails', () => {
    storageStub.setItem.mockImplementation(() => {
      throw new Error('Storage is unavailable')
    })
    const picker = useAccentColor()
    expect(() => {
      picker.accentPreference.value = 'teal'
    }).not.toThrow()
    expect(attributes.get('data-accent')).toBe('teal')
    expect(picker.accentPalette.value.primary).toBe(resolvedPalette('teal', true).primary)
  })

  it('rolls immediately when random is chosen and remembers it as the preference', () => {
    const picker = useAccentColor()
    mounted.forEach((callback) => callback())
    picker.accentPreference.value = 'random'
    const color = picker.accentColor.value
    expect(ACCENT_COLORS).toContain(color)
    expect(color).not.toBe('sky')
    expect(attributes.get('data-accent')).toBe(color)
    expect(picker.accentPalette.value.primary).toBe(resolvedPalette(color, true).primary)
    expect(stored.get(ACCENT_COLOR_STORAGE_KEY)).toBe(color)
    expect(stored.get(RANDOM_ACCENT_STORAGE_KEY)).toBe('true')

    states.clear()
    initialize()
    const reloaded = useAccentColor()
    mounted.at(-1)!()
    expect(reloaded.accentPreference.value).toBe('random')
    expect(reloaded.accentColor.value).toBe(attributes.get('data-accent'))
  })
})
