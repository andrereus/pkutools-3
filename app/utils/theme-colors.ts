export type ThemeChartPalette = { primary: string; strong: string; secondary: string }

// ApexCharts expects RGB/hex colors, while Tailwind and color-mix resolve to
// OKLCH/OKLab. Convert the browser's computed color without sampling a canvas
// (canvas privacy protection can perturb sampled pixels).
export const cssColorToHex = (color: string): string => {
  if (/^#[\da-f]{6}$/i.test(color)) return color.toLowerCase()
  const values = color.slice(color.indexOf('(') + 1).match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi)
  if (!values || values.length < 3) throw new Error(`Unsupported theme color: ${color}`)
  let channels = values.slice(0, 3).map(Number)
  if (color.startsWith('okl')) {
    const [lightness] = channels
    let [, a, b] = channels
    if (color.startsWith('oklch')) {
      const hue = (b * Math.PI) / 180
      b = a * Math.sin(hue)
      a *= Math.cos(hue)
    }
    const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
    const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
    const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3
    channels = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
    ].map((value) => (value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055))
    channels = channels.map((value) => value * 255)
  } else if (color.startsWith('color(srgb ')) {
    channels = channels.map((value) => value * 255)
  } else if (!color.startsWith('rgb')) {
    throw new Error(`Unsupported theme color: ${color}`)
  }
  return (
    '#' +
    channels
      .map((value) =>
        Math.round(Math.min(255, Math.max(0, value)))
          .toString(16)
          .padStart(2, '0')
      )
      .join('')
  )
}

export const readThemeChartPalette = (): ThemeChartPalette => {
  // Charts render on the client; use neutral placeholders during SSR.
  if (typeof document === 'undefined') {
    return { primary: '#808080', strong: '#404040', secondary: '#a0a0a0' }
  }
  const probe = document.createElement('span')
  probe.hidden = true
  document.documentElement.append(probe)
  const read = (role: string) => {
    probe.style.color = `var(--theme-chart-${role})`
    return cssColorToHex(getComputedStyle(probe).color)
  }
  try {
    return { primary: read('primary'), strong: read('strong'), secondary: read('secondary') }
  } finally {
    probe.remove()
  }
}
