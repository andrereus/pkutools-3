export const ACCENT_COLORS = ['sky', 'blue', 'violet', 'teal', 'orange', 'red'] as const
export type AccentColor = (typeof ACCENT_COLORS)[number]

// An extra choice in the picker, which resolves to one of the colors above.
export const RANDOM_ACCENT = 'random'
export type AccentPreference = AccentColor | typeof RANDOM_ACCENT
export const ACCENT_PREFERENCES = [...ACCENT_COLORS, RANDOM_ACCENT] as const

export const DEFAULT_ACCENT_COLOR: AccentColor = 'sky'
// Always holds one of ACCENT_COLORS, never "random", so the script below applies
// a usable color even when it predates the way that color was chosen.
export const ACCENT_COLOR_STORAGE_KEY = 'accent_color'
// Set when the color is rerolled on every app start.
export const RANDOM_ACCENT_STORAGE_KEY = 'accent_random'

// Chart colors as hex, since ApexCharts can't read CSS variables. Primary and
// strong are the Tailwind shades that bg-sky-500 and bg-sky-700 resolve to in
// each theme. The second series (tyrosine, kcal) is amber, except next to
// orange and red, which amber is too close to; teal replaces it.
export const ACCENT_PALETTES = {
  sky: { primary: '#0095e2', strong: '#006199', secondary: '#d97706' },
  blue: { primary: '#2b7fff', strong: '#1447e6', secondary: '#d97706' },
  violet: { primary: '#8e51ff', strong: '#7008e7', secondary: '#d97706' },
  teal: { primary: '#009689', strong: '#005f5a', secondary: '#d97706' },
  orange: { primary: '#fc5a00', strong: '#b43100', secondary: '#00bba7' },
  red: { primary: '#f11325', strong: '#b0000e', secondary: '#00bba7' }
} satisfies Record<AccentColor, { primary: string; strong: string; secondary: string }>

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
