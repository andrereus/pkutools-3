export const ACCENT_COLORS = ['sky', 'blue', 'violet', 'teal', 'orange', 'red'] as const
export type AccentColor = (typeof ACCENT_COLORS)[number]

// A seventh choice in the picker, which resolves to one of the colors above.
export const RANDOM_ACCENT = 'random'
export type AccentPreference = AccentColor | typeof RANDOM_ACCENT
export const ACCENT_PREFERENCES = [...ACCENT_COLORS, RANDOM_ACCENT] as const

export const DEFAULT_ACCENT_COLOR: AccentColor = 'sky'
// Always holds one of ACCENT_COLORS, never "random", so the script below applies
// a usable color even when it predates the way that color was chosen.
export const ACCENT_COLOR_STORAGE_KEY = 'accent_color'
// Set when the color is rerolled on every app start.
export const RANDOM_ACCENT_STORAGE_KEY = 'accent_random'

// Colors for the second chart series (tyrosine, kcal). Amber stays clearly apart
// from the cool accents, but sits right next to the warm ones, so those use teal.
const AMBER = { light: '#d97706', dark: '#d97706' }
const TEAL = { light: '#0d9488', dark: '#2dd4bf' }

type AccentPalette = {
  light: string
  dark: string
  strong: string
  secondary: { light: string; dark: string }
}

// Preserve the original Sky chart colors; adapt alternative palettes to the mode.
// CSS roles for the surrounding interface live in assets/css/themes.css.
export const ACCENT_PALETTES = {
  sky: { light: '#0ea5e9', dark: '#0ea5e9', strong: '#0369a1', secondary: AMBER },
  blue: { light: '#2563eb', dark: '#60a5fa', strong: '#1e40af', secondary: AMBER },
  violet: { light: '#7c3aed', dark: '#a78bfa', strong: '#5b21b6', secondary: AMBER },
  teal: { light: '#0d9488', dark: '#2dd4bf', strong: '#115e59', secondary: AMBER },
  orange: { light: '#ea580c', dark: '#fb923c', strong: '#9a3412', secondary: TEAL },
  red: { light: '#dc2626', dark: '#f87171', strong: '#b91c1c', secondary: TEAL }
} satisfies Record<AccentColor, AccentPalette>

export const resolveAccentColor = (value: unknown): AccentColor =>
  ACCENT_COLORS.includes(value as AccentColor) ? (value as AccentColor) : DEFAULT_ACCENT_COLOR

export const resolveAccentPreference = (value: unknown): AccentPreference =>
  ACCENT_PREFERENCES.includes(value as AccentPreference)
    ? (value as AccentPreference)
    : DEFAULT_ACCENT_COLOR

export const pickRandomAccent = (previous: unknown): AccentColor => {
  const choices = ACCENT_COLORS.filter((color) => color !== previous)
  return choices[Math.floor(Math.random() * choices.length)] as AccentColor
}

// Apply before the first paint, independently of hydration and Firebase.
// Storage may be unavailable in restricted browsers; sky remains the default.
export const accentColorInitScript = `
  try {
    const colors = ${JSON.stringify(ACCENT_COLORS)}
    const stored = localStorage.getItem('${ACCENT_COLOR_STORAGE_KEY}')
    let color = colors.includes(stored) ? stored : '${DEFAULT_ACCENT_COLOR}'
    const reroll = localStorage.getItem('${RANDOM_ACCENT_STORAGE_KEY}') === 'true'
    if (reroll) {
      const choices = colors.filter((c) => c !== color)
      color = choices[Math.floor(Math.random() * choices.length)]
    }
    document.documentElement.setAttribute('data-accent', color)
    if (reroll) {
      localStorage.setItem('${ACCENT_COLOR_STORAGE_KEY}', color)
    }
  } catch {}
`
