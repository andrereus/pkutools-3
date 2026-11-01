// An app left open, e.g. from the home screen, keeps running the build it first
// loaded: a page switch only swaps in code that is already in memory. Once a
// newer build is deployed, the next page switch loads the new page in full. The
// page changes at that moment anyway, so nothing typed is lost.

export default defineNuxtPlugin((nuxtApp) => {
  // Development has no deployed build to compare against
  if (import.meta.dev) return

  const { app } = useRuntimeConfig()
  let newBuild = false

  // Nuxt checks for a newer build every hour while the app runs
  nuxtApp.hook('app:manifest:update', () => {
    newBuild = true
  })

  // A phone can resume the app after days, so it also checks on return, from
  // another app as well as from the back-forward cache. The file is cached like
  // every build asset, so each check asks for a fresh copy.
  const check = async () => {
    if (newBuild || document.visibilityState !== 'visible') return
    try {
      const latest = await $fetch<{ id?: unknown }>(`${app.buildAssetsDir}builds/latest.json`, {
        baseURL: app.baseURL,
        query: { t: Date.now() }
      })
      if (typeof latest?.id === 'string' && latest.id !== app.buildId) newBuild = true
    } catch {
      // Offline or mid-deploy: the next return checks again
    }
  }
  document.addEventListener('visibilitychange', check)

  // Covers the page while the new one loads, so the tap shows it was taken
  let loading: HTMLElement | null = null
  const showLoading = () => {
    loading = document.createElement('div')
    loading.className =
      'fixed inset-0 z-70 flex items-center justify-center bg-gray-50/60 dark:bg-gray-950/60'
    loading.setAttribute('aria-hidden', 'true')
    loading.innerHTML =
      '<svg class="h-8 w-8 animate-spin text-sky-500 dark:text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>'
    document.body.append(loading)
  }

  // A page restored from the back-forward cache comes back without the cover
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return
    loading?.remove()
    loading = null
    void check()
  })

  // A switch loads the new page in full instead of showing it first. A step back
  // or forward has already changed the address, so it reloads once it lands,
  // which keeps the history intact. A change of only the hash or query stays on
  // the page, and a stopped switch keeps the page as it is.
  const router = useRouter()
  router.beforeEach((to, from) => {
    if (!newBuild || to.path === from.path || window.location.pathname === to.path) return
    showLoading()
    window.location.assign(to.fullPath)
    return false
  })
  router.afterEach((to, from, failure) => {
    if (newBuild && !failure && to.path !== from.path) reloadNuxtApp()
  })
})
