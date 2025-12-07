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
let resolvePromise: ((value: boolean) => void) | null = null

const confirm = (options: ConfirmOptions): Promise<boolean> => {
  return new Promise((resolve) => {
    resolvePromise = resolve
    confirmState.value = {
      confirmLabel: 'Confirm',
      cancelLabel: 'Cancel',
      ...options
    }
    showConfirm.value = true
  })
}

const handleConfirm = () => {
  if (resolvePromise) {
    resolvePromise(true)
    resolvePromise = null
  }
  showConfirm.value = false
  // Clear state after animation
  setTimeout(() => {
    confirmState.value = null
  }, 300)
}

const handleCancel = () => {
  if (resolvePromise) {
    resolvePromise(false)
    resolvePromise = null
  }
  showConfirm.value = false
  // Clear state after animation
  setTimeout(() => {
    confirmState.value = null
  }, 300)
}

export const useConfirm = () => {
  return {
    confirmState: readonly(confirmState),
    showConfirm: readonly(showConfirm),
    confirm,
    handleConfirm,
    handleCancel
  }
}
