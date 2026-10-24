// Global `v-auto-grow` directive: a <textarea> grows to fit its content instead
// of scrolling. The `rows` attribute stays as the minimum height. A mobile-
// friendly replacement for the hard-to-tap native resize grip.

const grow = (el: HTMLTextAreaElement) => {
  el.style.height = 'auto' // reset so it can shrink too (falls back to `rows`)
  // A hidden field measures 0; it keeps `rows` until it is measured visible.
  if (el.scrollHeight > 0) el.style.height = `${el.scrollHeight}px`
}

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive('auto-grow', {
    mounted(el: HTMLTextAreaElement) {
      el.style.resize = 'none'
      grow(el)
    },
    // `v-model` re-renders on every keystroke, so `updated` re-measures as the
    // user types — no manual input listener (or its cleanup) needed.
    updated: grow
  })
})
