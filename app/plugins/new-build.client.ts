// An app left open, e.g. from the home screen, keeps running the build it first
// loaded: a page switch only swaps in code that is already in memory. Once a
// newer build is deployed, the next page switch also reloads the page. The page
// changes at that moment anyway, so nothing typed is lost.

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
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) void check()
  })

  // Reloads once the switch has landed, so back and forward keep their history.
  // A change of only the hash or query stays on the page, and a stopped switch
  // keeps the page as it is.
  useRouter().afterEach((to, from, failure) => {
    if (newBuild && !failure && to.path !== from.path) reloadNuxtApp()
  })
})
