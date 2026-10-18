<script setup>
const pageDirection = usePageDirection()
const navigationCount = usePageNavigationCount()
const toolPageShown = useToolPageShown()
const router = useRouter()
const getRouteBaseName = useRouteBaseName()

const isToolRoute = () => toolPages.includes(getRouteBaseName(router.currentRoute.value))
toolPageShown.value = isToolRoute()

// Between tab pages both pages slide at the same time, side by side. Once the
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
    transform 0.25s cubic-bezier(0.22, 1, 0.36, 1);
}

/* A leaving page still shows while it slides out, but no longer takes taps */
.page-leave-active {
  transition: none;
  pointer-events: none;
}

.page-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.page-leave-to {
  opacity: 0;
}

/* Between tab pages the page-direction middleware sets a direction on the root
   element. Both pages then slide one screen width, the old page out toward one
   side and the new page in from the other. */
[data-page-direction] .page-enter-active,
[data-page-direction] .page-leave-active {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}

[data-page-direction='forward'] .page-enter-from,
[data-page-direction='back'] .page-leave-to {
  opacity: 1;
  transform: translateX(100vw);
}

[data-page-direction='forward'] .page-leave-to,
[data-page-direction='back'] .page-enter-from {
  opacity: 1;
  transform: translateX(-100vw);
}

/* On wide screens, where the tab bar sits at the top, the pages don't slide.
   The new page rises in like on any other page change, while the old page
   fades out faster, so the two hardly overlap. */
@media (min-width: 1024px) {
  [data-page-direction] .page-enter-active {
    transition:
      opacity 0.2s ease-out,
      transform 0.25s cubic-bezier(0.22, 1, 0.36, 1);
  }

  [data-page-direction] .page-leave-active {
    transition: opacity 0.12s ease-out;
  }

  [data-page-direction] .page-enter-from {
    opacity: 0;
    transform: translateY(8px);
  }

  [data-page-direction] .page-leave-to {
    opacity: 0;
    transform: none;
  }
}
</style>
