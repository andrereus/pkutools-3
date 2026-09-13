import {
  ACCENT_COLOR_STORAGE_KEY,
  DEFAULT_ACCENT_COLOR,
  RANDOM_ACCENT,
  RANDOM_ACCENT_STORAGE_KEY,
  pickRandomAccent,
  resolveAccentColor,
  resolveAccentPreference,
  type AccentColor,
  type AccentPreference
} from '#shared/utils/accent-color'
import { readThemeChartPalette } from '../utils/theme-colors'

export const useAccentColor = () => {
  // What the picker shows, which can be "random", and the color it resolved to.
  const preference = useState<AccentPreference>('accent-preference', () => DEFAULT_ACCENT_COLOR)
  const applied = useState<AccentColor>('accent-color', () => DEFAULT_ACCENT_COLOR)
  const palette = useState('accent-palette', readThemeChartPalette)
  const updatePalette = () => {
    palette.value = readThemeChartPalette()
  }
  let observer: MutationObserver | undefined

  // Keep SSR and hydration identical; the head script already colors the page.
  onMounted(() => {
    const root = document.documentElement
    applied.value = resolveAccentColor(root.getAttribute('data-accent'))
    try {
      preference.value =
        localStorage.getItem(RANDOM_ACCENT_STORAGE_KEY) === 'true' ? RANDOM_ACCENT : applied.value
    } catch {
      preference.value = applied.value
    }
    updatePalette()
    observer = new MutationObserver(updatePalette)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
  })

  onUnmounted(() => observer?.disconnect())

  const accentPreference = computed({
    get: () => preference.value,
    set: (value: AccentPreference) => {
      preference.value = resolveAccentPreference(value)
      const reroll = preference.value === RANDOM_ACCENT
      // Rolling here shows the effect straight away, without waiting for a restart.
      applied.value = reroll ? pickRandomAccent(applied.value) : (preference.value as AccentColor)
      document.documentElement.setAttribute('data-accent', applied.value)
      updatePalette()
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

  const accentPalette = computed(() => palette.value)

  return { accentPreference, accentColor, accentPalette }
}
