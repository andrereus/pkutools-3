export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'destructive' | 'default'
}

// Singleton state for confirm dialog
const confirmState = ref<ConfirmOptions | null>(null)
const showConfirm = ref(false)
let resolvePromise: ((value: boolean | null) => void) | null = null
// Keep the state through the closing animation without clearing a newer dialog.
let clearStateTimer: ReturnType<typeof setTimeout> | null = null

const clearStateAfterAnimation = () => {
  if (clearStateTimer) clearTimeout(clearStateTimer)
  clearStateTimer = setTimeout(() => {
    confirmState.value = null
    clearStateTimer = null
  }, 300)
}

const confirm = (options: ConfirmOptions): Promise<boolean | null> => {
  return new Promise((resolve) => {
    if (clearStateTimer) {
      clearTimeout(clearStateTimer)
      clearStateTimer = null
    }
    // Replacing a question declines the previous one.
    if (resolvePromise) resolvePromise(false)
    resolvePromise = resolve
    confirmState.value = {
      confirmLabel: 'Confirm',
      cancelLabel: 'Cancel',
      ...options
    }
    showConfirm.value = true
  })
}

// Ignore duplicate close events for an already answered question.
const settle = (answer: boolean | null) => {
  if (!resolvePromise) return
  resolvePromise(answer)
  resolvePromise = null
  showConfirm.value = false
  clearStateAfterAnimation()
}

const handleConfirm = () => settle(true)

const handleCancel = () => settle(false)

const handleDismiss = () => settle(null)

export const useConfirm = () => {
  return {
    confirmState: readonly(confirmState),
    showConfirm: readonly(showConfirm),
    confirm,
    handleConfirm,
    handleCancel,
    handleDismiss
  }
}
