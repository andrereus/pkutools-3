<script setup>
const props = defineProps({
  title: {
    type: String,
    required: true
  },
  // Short text shown in the card's top-right corner, next to the title
  // (e.g. the time a diary entry was logged)
  meta: {
    type: String,
    default: ''
  },
  // Optional emoji shown before the meta text in the top-right corner
  // (e.g. the food emoji of the opened entry)
  emoji: {
    type: String,
    default: ''
  },
  buttons: {
    type: Array,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  }
})
const emit = defineEmits(['close', 'edit', 'submit', 'delete'])

// Imperative API preserved for callers (dialog.value.openDialog()), backed by a
// reactive flag so nuxt-headlessui can drive the open/close transitions.
const show = ref(false)
const errorMessage = ref('')
// Neutral initial-focus target so headlessui doesn't autofocus the first input
// (often a date picker, which pops the keyboard/picker on mobile).
const initialFocusRef = ref(null)
const notifications = useNotifications()
let unregisterSink = null

function openDialog() {
  show.value = true
}

function closeDialog() {
  show.value = false
}

// Esc / backdrop dismissal: close, and notify the parent so its cancel cleanup
// runs on every close path (matches clicking a Cancel button). Harmless for
// callers that don't listen for 'close'.
function handleDismiss() {
  closeDialog()
  emit('close')
}

defineExpose({ openDialog, closeDialog })

// While open, route error notifications into an inline banner instead of a toast
// layered over the dialog. The stack in useNotifications handles nested dialogs.
watch(show, (open) => {
  if (open) {
    errorMessage.value = ''
    unregisterSink = notifications.registerErrorSink((message) => {
      errorMessage.value = message
    })
  } else {
    unregisterSink?.()
    unregisterSink = null
  }
})

onUnmounted(() => unregisterSink?.())

const filteredButtons = computed(() => {
  const visible = props.buttons.filter((button) => button.visible !== false)

  // Sort buttons in consistent order: Cancel/Close left, Delete middle, Submit right
  const buttonOrder = { close: 1, simpleClose: 1, delete: 2, edit: 2, submit: 3 }

  return visible.sort((a, b) => {
    const orderA = buttonOrder[a.type] || 3
    const orderB = buttonOrder[b.type] || 3
    return orderA - orderB
  })
})

function handleButtonClick(buttonType) {
  // Don't allow clicks on disabled buttons
  if (props.loading && (buttonType === 'submit' || buttonType === 'delete')) {
    return
  }

  // New attempt — clear any previous inline error
  if (buttonType === 'submit' || buttonType === 'delete') {
    errorMessage.value = ''
  }

  if (buttonType === 'simpleClose') {
    closeDialog()
  } else if (buttonType === 'close') {
    emit('close')
  } else if (buttonType === 'edit') {
    emit('edit')
  } else if (buttonType === 'submit') {
    emit('submit')
  } else if (buttonType === 'delete') {
    emit('delete')
  }
}
</script>

<template>
  <HeadlessTransitionRoot as="template" :show="show">
    <HeadlessDialog
      class="relative z-60 dark:text-white"
      :initial-focus="initialFocusRef"
      @close="handleDismiss"
    >
      <HeadlessTransitionChild
        as="template"
        enter="ease-out duration-300"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-200"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-gray-500/75 transition-opacity dark:bg-black/70" />
      </HeadlessTransitionChild>

      <div class="fixed inset-0 z-10 w-screen overflow-y-auto">
        <div class="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
          <HeadlessTransitionChild
            as="template"
            enter="ease-out duration-300"
            enter-from="opacity-0 scale-95"
            enter-to="opacity-100 scale-100"
            leave="ease-in duration-200"
            leave-from="opacity-100 scale-100"
            leave-to="opacity-0 scale-95"
          >
            <HeadlessDialogPanel
              class="relative transform overflow-hidden rounded-xl bg-white dark:bg-gray-900 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 w-full max-w-md sm:max-w-lg sm:p-6"
            >
              <div ref="initialFocusRef" tabindex="-1" class="focus:outline-none">
                <div>
                  <div class="flex items-baseline justify-between gap-3">
                    <HeadlessDialogTitle
                      as="h3"
                      class="text-base font-semibold leading-6 text-gray-900 dark:text-white"
                    >
                      {{ title }}
                    </HeadlessDialogTitle>
                    <span
                      v-if="meta || emoji"
                      class="flex shrink-0 items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400"
                    >
                      <span v-if="emoji" class="text-xl leading-none">{{ emoji }}</span
                      >{{ meta }}
                    </span>
                  </div>
                  <div class="mt-3">
                    <slot />
                  </div>
                </div>
              </div>
              <div
                v-if="errorMessage"
                role="alert"
                class="mt-4 rounded-lg bg-red-50 px-3 py-2 text-left text-sm text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/20"
              >
                {{ errorMessage }}
              </div>
              <div
                :class="[
                  'mt-5 sm:mt-6',
                  filteredButtons.length === 1
                    ? ''
                    : filteredButtons.length === 2
                      ? 'grid grid-cols-2 gap-3'
                      : filteredButtons.length === 3
                        ? 'grid grid-cols-3 gap-3'
                        : 'grid grid-cols-2 gap-3'
                ]"
              >
                <button
                  v-for="button in filteredButtons"
                  :key="button.type"
                  type="button"
                  :disabled="loading && (button.type === 'submit' || button.type === 'delete')"
                  :class="[
                    'inline-flex w-full justify-center rounded-full px-3 py-2 text-sm font-semibold shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2',
                    loading && (button.type === 'submit' || button.type === 'delete')
                      ? 'opacity-50 cursor-not-allowed'
                      : 'cursor-pointer',
                    button.type === 'delete'
                      ? 'bg-red-500 text-white hover:bg-red-600 focus-visible:outline-red-500 dark:bg-red-500 dark:shadow-none dark:hover:bg-red-400 dark:focus-visible:outline-red-500'
                      : button.type === 'simpleClose' ||
                          button.type === 'close' ||
                          button.type === 'edit'
                        ? 'bg-white text-gray-900 hover:bg-gray-50 ring-1 ring-inset ring-gray-300 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700 dark:ring-gray-600 focus-visible:outline-gray-500 dark:focus-visible:outline-gray-400'
                        : 'bg-sky-500 text-white hover:bg-sky-600 focus-visible:outline-sky-500 dark:bg-sky-500 dark:shadow-none dark:hover:bg-sky-400 dark:focus-visible:outline-sky-500'
                  ]"
                  :autofocus="
                    button.type === 'submit' ||
                    button.type === 'simpleClose' ||
                    button.type === 'close'
                  "
                  @click="handleButtonClick(button.type)"
                >
                  {{ loading && button.type === 'submit' ? $t('common.saving') : button.label }}
                </button>
              </div>
            </HeadlessDialogPanel>
          </HeadlessTransitionChild>
        </div>
      </div>
    </HeadlessDialog>
  </HeadlessTransitionRoot>
</template>
