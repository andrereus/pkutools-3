import { afterEach, describe, expect, it, vi } from 'vitest'
import { cssColorToHex, readThemeChartPalette } from '../app/utils/theme-colors'

afterEach(() => vi.unstubAllGlobals())

describe('chart color conversion', () => {
  it.each([
    ['#ABCDEF', '#abcdef'],
    ['rgb(255, 128, 0)', '#ff8000'],
    ['rgba(0, 128, 255, 1)', '#0080ff'],
    ['color(srgb 1 0.5 0)', '#ff8000'],
    ['oklab(1 0 0)', '#ffffff'],
    ['oklab(0 0 0)', '#000000'],
    ['oklch(0.62795536 0.25768331 29.233885)', '#ff0000'],
    ['oklab(0.62795536 0.22486306 0.1258463)', '#ff0000'],
    ['oklch(0.86643961 0.29482724 142.49534)', '#00ff00'],
    ['oklch(0.45201372 0.31321437 264.05202)', '#0000ff']
  ])('converts computed %s to an ApexCharts color', (input, expected) => {
    expect(cssColorToHex(input)).toBe(expected)
  })

  it('uses neutral placeholders during SSR without accessing a DOM', () => {
    vi.stubGlobal('document', undefined)
    expect(readThemeChartPalette()).toEqual({
      primary: '#808080',
      strong: '#404040',
      secondary: '#a0a0a0'
    })
  })

  it('reads each role from the stylesheet and removes its temporary element', () => {
    const probe = { hidden: false, style: { color: '' }, remove: vi.fn() }
    const colors: Record<string, string> = {
      'var(--theme-chart-primary)': 'rgb(10, 20, 30)',
      'var(--theme-chart-strong)': 'rgb(1, 2, 3)',
      'var(--theme-chart-secondary)': 'rgb(40, 50, 60)'
    }
    vi.stubGlobal('document', {
      createElement: () => probe,
      documentElement: { append: vi.fn() }
    })
    vi.stubGlobal('getComputedStyle', () => ({ color: colors[probe.style.color] }))
    expect(readThemeChartPalette()).toEqual({
      primary: '#0a141e',
      strong: '#010203',
      secondary: '#28323c'
    })
    expect(probe.hidden).toBe(true)
    expect(probe.remove).toHaveBeenCalledOnce()
  })
})
