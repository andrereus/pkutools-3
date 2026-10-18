<script setup>
const pageDirection = usePageDirection()
const navigationCount = usePageNavigationCount()
const toolPageShown = useToolPageShown()
const router = useRouter()
const getRouteBaseName = useRouteBaseName()

const isToolRoute = () => toolPages.includes(getRouteBaseName(router.currentRoute.value))
toolPageShown.value = isToolRoute()

// Between tab pages both pages are on screen at the same time. Once the
// new page is in, the direction is cleared, so a later change without a
// navigation, such as the tool row leaving on sign-out, doesn't slide.
let enteringNavigation = 0
const pageTransition = computed(() => ({
  name: 'page',
  mode: pageDirection.value ? 'default' : 'out-in',
  onBeforeLeave: (el) => {
    if (pageDirection.value) pinLeavingElement(el)
  },
  onBeforeEnter: () => {
    toolPageShown.value = isToolRoute()
    enteringNavigation = navigationCount.value
  },
  onAfterEnter: () => {
    if (navigationCount.value !== enteringNavigation) return
    pageDirection.value = null
    delete document.documentElement.dataset.pageDirection
  }
}))
</script>

<template>
  <div>
    <NuxtLayout>
      <NuxtPage :transition="pageTransition" />
    </NuxtLayout>
  </div>
</template>

<style>
.page-enter-active {
  transition:
    opacity 0.2s ease-out,
    transform 0.25s cubic-bezier(0.33, 1, 0.68, 1);
}

/* A leaving page can still show while it moves out, but no longer takes taps */
.page-leave-active {
  transition: none;
  pointer-events: none;
}

.page-enter-from {
  opacity: 0;
  transform: translateY(16px);
}

.page-leave-to {
  opacity: 0;
}

/* Between tab pages the page-direction middleware sets a direction on the root
   element. Both pages then cross-fade quickly while they shift a short way
   along the tab bar, the old page half as far. */
[data-page-direction] .page-enter-active {
  transition:
    opacity 0.15s ease-out,
    transform 0.3s cubic-bezier(0.33, 1, 0.68, 1);
}

[data-page-direction] .page-leave-active {
  transition:
    opacity 0.12s ease-out,
    transform 0.12s ease-out;
}

[data-page-direction] .page-enter-from,
[data-page-direction] .page-leave-to {
  opacity: 0;
}

[data-page-direction='forward'] .page-enter-from {
  transform: translateX(32px);
}

[data-page-direction='back'] .page-enter-from {
  transform: translateX(-32px);
}

[data-page-direction='forward'] .page-leave-to {
  transform: translateX(-16px);
}

[data-page-direction='back'] .page-leave-to {
  transform: translateX(16px);
}
</style>
