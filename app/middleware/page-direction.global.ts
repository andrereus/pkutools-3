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

// Between two tab pages, pages slide along the tab bar, and between two tools
// along the tool row. Any other navigation keeps the default page transition.
// The direction also goes on the root element for the CSS, because the leaving
// page keeps the transition name it was rendered with.
export default defineNuxtRouteMiddleware((to, from) => {
  if (import.meta.server) return

  const tabs = useStore().user ? signedInTabs : signedOutTabs
  const getRouteBaseName = useRouteBaseName()
  const fromName = getRouteBaseName(from) ?? ''
  const toName = getRouteBaseName(to) ?? ''

  let fromPosition = tabs.findIndex((slot) => slot.includes(fromName))
  let toPosition = tabs.findIndex((slot) => slot.includes(toName))
  if (fromPosition !== -1 && fromPosition === toPosition) {
    fromPosition = toolPages.indexOf(fromName)
    toPosition = toolPages.indexOf(toName)
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
