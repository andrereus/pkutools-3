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
