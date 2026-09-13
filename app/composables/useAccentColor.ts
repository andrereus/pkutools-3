import {
  ACCENT_COLOR_STORAGE_KEY,
  ACCENT_PALETTES,
  DEFAULT_ACCENT_COLOR,
  RANDOM_ACCENT,
  RANDOM_ACCENT_STORAGE_KEY,
  pickRandomAccent,
  resolveAccentColor,
  resolveAccentPreference,
  type AccentColor,
  type AccentPreference
} from '#shared/utils/accent-color'

export const useAccentColor = () => {
  // What the picker shows, which can be "random", and the color it resolved to.
  const preference = useState<AccentPreference>('accent-preference', () => DEFAULT_ACCENT_COLOR)
  const applied = useState<AccentColor>('accent-color', () => DEFAULT_ACCENT_COLOR)

  // Keep SSR and hydration identical; the head script already colors the page.
  onMounted(() => {
    applied.value = resolveAccentColor(document.documentElement.getAttribute('data-accent'))
    try {
      preference.value =
        localStorage.getItem(RANDOM_ACCENT_STORAGE_KEY) === 'true' ? RANDOM_ACCENT : applied.value
    } catch {
      preference.value = applied.value
    }
  })

  const accentPreference = computed({
    get: () => preference.value,
    set: (value: AccentPreference) => {
      preference.value = resolveAccentPreference(value)
      const reroll = preference.value === RANDOM_ACCENT
      // Rolling here shows the effect straight away, without waiting for a restart.
      applied.value = reroll ? pickRandomAccent(applied.value) : (preference.value as AccentColor)
      document.documentElement.setAttribute('data-accent', applied.value)
      try {
        localStorage.setItem(ACCENT_COLOR_STORAGE_KEY, applied.value)
        if (reroll) localStorage.setItem(RANDOM_ACCENT_STORAGE_KEY, 'true')
        else localStorage.removeItem(RANDOM_ACCENT_STORAGE_KEY)
      } catch {
        // The choice still applies for this visit when storage is unavailable.
      }
    }
  })

  const accentColor = computed(() => applied.value)
  const accentPalette = computed(() => ACCENT_PALETTES[applied.value])

  return { accentPreference, accentColor, accentPalette }
}
