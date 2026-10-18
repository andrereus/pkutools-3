import type { RouteLocationNormalized } from 'vue-router'
import { useStore } from '../../stores/index'

// The tab bar slots in the default layout, left to right. Pages that share a
// slot share its position: Home covers the start page and the diary, and Add
// covers the four tools.
const signedInTabs = [
  ['index', 'diary'],
  ['diet-report'],
  toolPages,
  ['blood-values'],
  ['own-food']
]
const signedOutTabs = [['index'], ...toolPages.map((tool) => [tool])]

// Between two tab pages, pages slide along the tab bar: forward to a tab on the
// right, back to one on the left. Between two tools, they slide along the tool
// row. Every other navigation keeps the default page transition. The direction
// is shared state for the page transition in app.vue and goes on the root
// element for its CSS. The CSS can't rely on a transition name, because the
// leaving page keeps the transition it was rendered with.
export default defineNuxtRouteMiddleware((to, from) => {
  if (import.meta.server) return

  const tabs = useStore().user ? signedInTabs : signedOutTabs
  const baseName = (route: RouteLocationNormalized) => String(route.name ?? '').split('___')[0]
  const position = (route: RouteLocationNormalized) =>
    tabs.findIndex((slot) => slot.includes(baseName(route)))

  let fromPosition = position(from)
  let toPosition = position(to)
  if (fromPosition !== -1 && fromPosition === toPosition) {
    fromPosition = toolPages.indexOf(baseName(from))
    toPosition = toolPages.indexOf(baseName(to))
  }

  usePageNavigationCount().value++
  const direction = usePageDirection()
  const root = document.documentElement
  if (fromPosition === -1 || toPosition === -1 || fromPosition === toPosition) {
    direction.value = null
    delete root.dataset.pageDirection
  } else {
    direction.value = toPosition > fromPosition ? 'forward' : 'back'
    root.dataset.pageDirection = direction.value
  }
})
