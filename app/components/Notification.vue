<script setup>
import { LucideX } from 'lucide-vue-next'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    default: 'info', // 'info', 'success', 'error', 'warning'
    validator: (value) => ['info', 'success', 'error', 'warning'].includes(value)
  },
  undoAction: {
    type: Function,
    default: null
  },
  undoLabel: {
    type: String,
    default: 'Undo'
  }
})

const emit = defineEmits(['close', 'undo'])

let dismissTimeout = null

const handleClose = () => {
  // Clear any pending timeout
  if (dismissTimeout) {
    clearTimeout(dismissTimeout)
    dismissTimeout = null
  }
  emit('close')
}

const handleUndo = () => {
  if (props.undoAction) {
    props.undoAction()
  }
  emit('undo')
  emit('close')
}

// Auto-dismiss after 5 seconds for all notifications
watch(
  () => props.show,
  (newVal) => {
    // Clear any existing timeout
    if (dismissTimeout) {
      clearTimeout(dismissTimeout)
      dismissTimeout = null
    }

    // Set new timeout if notification is shown
    if (newVal) {
      dismissTimeout = setTimeout(() => {
        handleClose()
      }, 5000)
    }
  },
  { immediate: true }
)

// Cleanup on unmount
onUnmounted(() => {
  if (dismissTimeout) {
    clearTimeout(dismissTimeout)
  }
})

// Type-specific styling
const typeStyles = {
  info: 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white',
  success: 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white',
  error: 'bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-300',
  warning: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-900 dark:text-yellow-300'
}

const buttonStyles = {
  info: 'text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300',
  success: 'text-green-600 hover:text-green-500 dark:text-green-400 dark:hover:text-green-300',
  error: 'text-red-600 hover:text-red-500 dark:text-red-400 dark:hover:text-red-300',
  warning: 'text-yellow-600 hover:text-yellow-500 dark:text-yellow-400 dark:hover:text-yellow-300'
}
</script>

<template>
  <!-- Global notification live region, render this permanently at the end of the document -->
  <Teleport to="body">
    <div
      aria-live="assertive"
      class="pointer-events-none fixed inset-0 z-50 flex items-end px-4 py-6 sm:items-start sm:p-6"
    >
      <div class="flex w-full flex-col items-center space-y-4 sm:items-end">
        <!-- Notification panel, dynamically insert this into the live region when it needs to be displayed -->
        <Transition
          enter-active-class="transform ease-out duration-300 transition"
          enter-from-class="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2"
          enter-to-class="translate-y-0 sm:translate-x-0"
          leave-active-class="transition ease-in duration-100"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <div
            v-if="show"
            :class="[
              'pointer-events-auto w-full max-w-sm rounded-lg shadow-lg outline-1 outline-black/5 dark:-outline-offset-1 dark:outline-white/10',
              typeStyles[type]
            ]"
          >
            <div class="p-4">
              <div class="flex items-center">
                <div class="flex w-0 flex-1 justify-between">
                  <p class="w-0 flex-1 text-sm font-medium">{{ message }}</p>
                  <button
                    v-if="undoAction"
                    type="button"
                    :class="[
                      'ml-3 shrink-0 rounded-md bg-transparent text-sm font-medium focus:outline-2 focus:outline-offset-2',
                      buttonStyles[type]
                    ]"
                    @click="handleUndo"
                  >
                    {{ undoLabel }}
                  </button>
                </div>
                <div class="ml-4 flex shrink-0">
                  <button
                    type="button"
                    class="inline-flex rounded-md text-gray-400 hover:text-gray-500 focus:outline-2 focus:outline-offset-2 focus:outline-indigo-600 dark:hover:text-white dark:focus:outline-indigo-500"
                    @click="handleClose"
                  >
                    <span class="sr-only">Close</span>
                    <LucideX class="size-5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </Teleport>
</template>
