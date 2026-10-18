// The tool pages, in the order of the tool row above them. ToolSwitcher lists
// them in the same order.
export const toolPages = ['food-search', 'barcode-scanner', 'ai-calculator', 'phe-calculator']

// Direction of the current navigation between tab pages, set by the
// page-direction middleware: 'forward' to a tab on the right, 'back' to one on
// the left, null for any other navigation.
export const usePageDirection = () =>
  useState<'forward' | 'back' | null>('page-direction', () => null)

// Counts navigations, so the page transition can tell whether the direction it
// would clear after entering already belongs to a newer navigation.
export const usePageNavigationCount = () => useState<number>('page-navigation-count', () => 0)

// Whether the page on screen is a tool page. Set by the page transition in
// app.vue, because the route changes before the new page is shown.
export const useToolPageShown = () => useState<boolean>('tool-page-shown', () => false)

let scrollQueued = false

// While two pages are on screen at once, a leaving element stays pinned where it
// is on screen and the window jumps to the top for the new page. The jump waits
// until every leaving element has been measured.
export const pinLeavingElement = (el: HTMLElement) => {
  const { top, left, width } = el.getBoundingClientRect()
  Object.assign(el.style, {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
    width: `${width}px`
  })
  if (scrollQueued) return
  scrollQueued = true
  queueMicrotask(() => {
    scrollQueued = false
    window.scrollTo({ top: 0, behavior: 'instant' })
  })
}
