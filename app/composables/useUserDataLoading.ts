import { useStore } from '../../stores/index'

/**
 * True while a page that shows the signed-in user's data can't show it yet:
 * until the page is mounted, until Firebase has reported the sign-in state and,
 * when signed in, until `isLoaded` returns true or loading the data has failed.
 *
 * Waiting for the mount matters after a navigation: the page is built detached
 * from the document until the previous page has left, and a chart created in
 * that window is never drawn.
 */
export function useUserDataLoading(isLoaded: () => boolean) {
  const store = useStore()
  const mounted = ref(false)
  onMounted(() => {
    mounted.value = true
  })
  return computed(
    () =>
      !mounted.value ||
      !store.authChecked ||
      (store.user !== null && !isLoaded() && !store.userDataFailed)
  )
}
