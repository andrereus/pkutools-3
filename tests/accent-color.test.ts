import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runInNewContext } from 'node:vm'
import { computed, ref, type Ref } from 'vue'
import {
  ACCENT_COLORS,
  ACCENT_COLOR_STORAGE_KEY,
  ACCENT_PALETTES,
  RANDOM_ACCENT_STORAGE_KEY,
  accentColorInitScript
} from '../shared/utils/accent-color'
import { useAccentColor } from '../app/composables/useAccentColor'

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
  it('keeps the original Sky chart and overage colors in both display modes', () => {
    const { accentPalette } = useAccentColor()
    const original = { primary: '#0ea5e9', strong: '#0369a1', secondary: '#d97706' }
    expect(accentPalette.value).toEqual(original)
    mounted.forEach((callback) => callback())
    expect(accentPalette.value).toEqual(original)
    attributes.set('class', '')
    modeChanged.forEach((callback) => callback())
    expect(accentPalette.value).toEqual(original)
  })

  it('hydrates with the default, then restores the saved choice for the picker and charts', () => {
    stored.set('accent_color', 'violet')
    initialize()
    const picker = useAccentColor()
    const chart = useAccentColor()
    expect(picker.accentPreference.value).toBe('sky')
    mounted.forEach((callback) => callback())
    expect(picker.accentPreference.value).toBe('violet')
    expect(chart.accentPalette.value.primary).toBe('#a78bfa')

    attributes.set('class', '')
    modeChanged.forEach((callback) => callback())
    expect(chart.accentPalette.value.primary).toBe('#7c3aed')
  })

  it('applies a choice immediately, updates charts, persists across reload and can reset to sky', () => {
    const picker = useAccentColor()
    const chart = useAccentColor()
    picker.accentPreference.value = 'red'
    expect(attributes.get('data-accent')).toBe('red')
    expect(chart.accentPalette.value).toEqual({
      primary: '#dc2626',
      strong: '#b91c1c',
      secondary: '#0d9488'
    })
    expect(stored.get('accent_color')).toBe('red')

    attributes.delete('data-accent')
    states.clear()
    initialize()
    const reloaded = useAccentColor()
    mounted.at(-1)!()
    expect(reloaded.accentColor.value).toBe('red')
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
    expect(picker.accentPalette.value.primary).toBe('#0d9488')
  })

  it('rolls immediately when random is chosen and remembers it as the preference', () => {
    const picker = useAccentColor()
    mounted.forEach((callback) => callback())
    picker.accentPreference.value = 'random'
    const color = picker.accentColor.value
    expect(ACCENT_COLORS).toContain(color)
    expect(color).not.toBe('sky')
    expect(attributes.get('data-accent')).toBe(color)
    expect(picker.accentPalette.value.primary).toBe(ACCENT_PALETTES[color].dark)
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
