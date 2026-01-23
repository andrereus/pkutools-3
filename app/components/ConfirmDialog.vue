<template>
  <TransitionRoot as="template" :show="show">
    <Dialog class="relative z-10" @close="handleCancel">
      <TransitionChild
        as="template"
        enter="ease-out duration-300"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-200"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-gray-500/75 transition-opacity dark:bg-gray-900/50" />
      </TransitionChild>

      <div class="fixed inset-0 z-10 w-screen overflow-y-auto">
        <div
          class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0"
        >
          <TransitionChild
            as="template"
            enter="ease-out duration-300"
            enter-from="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enter-to="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-200"
            leave-from="opacity-100 translate-y-0 sm:scale-100"
            leave-to="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          >
            <DialogPanel
              class="relative transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-gray-800 dark:outline dark:-outline-offset-1 dark:outline-white/10"
            >
              <div class="sm:flex sm:items-start">
                <div :class="iconContainerClass">
                  <component :is="iconComponent" :class="iconClass" aria-hidden="true" />
                </div>
                <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <DialogTitle
                    as="h3"
                    class="text-base font-semibold text-gray-900 dark:text-white"
                  >
                    {{ title }}
                  </DialogTitle>
                  <div v-if="message" class="mt-2">
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                      {{ message }}
                    </p>
                  </div>
                </div>
              </div>
              <div class="mt-5 sm:mt-4 flex flex-row-reverse gap-3">
                <button type="button" :class="confirmButtonClass" @click="handleConfirm">
                  {{ confirmLabel }}
                </button>
                <button
                  type="button"
                  class="inline-flex flex-1 justify-center rounded-full bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500 dark:bg-white/10 dark:text-white dark:shadow-none dark:ring-white/5 dark:hover:bg-white/20 dark:focus-visible:outline-gray-400"
                  @click="handleCancel"
                  ref="cancelButtonRef"
                >
                  {{ cancelLabel }}
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup>
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue'
import { LucideAlertTriangle, LucideInfo } from 'lucide-vue-next'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: false
  },
  confirmLabel: {
    type: String,
    default: 'Confirm'
  },
  cancelLabel: {
    type: String,
    default: 'Cancel'
  },
  variant: {
    type: String,
    default: 'destructive', // 'destructive' or 'default'
    validator: (value) => ['destructive', 'default'].includes(value)
  }
})

const emit = defineEmits(['confirm', 'cancel'])

const cancelButtonRef = ref(null)

const isDestructive = computed(() => props.variant === 'destructive')

const iconComponent = computed(() => (isDestructive.value ? LucideAlertTriangle : LucideInfo))

const iconContainerClass = computed(() =>
  isDestructive.value
    ? 'mx-auto flex size-12 shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:size-10 dark:bg-red-500/10'
    : 'mx-auto flex size-12 shrink-0 items-center justify-center rounded-full bg-sky-100 sm:mx-0 sm:size-10 dark:bg-sky-500/10'
)

const iconClass = computed(() =>
  isDestructive.value
    ? 'size-6 text-red-600 dark:text-red-400'
    : 'size-6 text-sky-600 dark:text-sky-400'
)

const confirmButtonClass = computed(() =>
  isDestructive.value
    ? 'inline-flex flex-1 justify-center rounded-full bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-red-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 dark:bg-red-500 dark:shadow-none dark:hover:bg-red-400 dark:focus-visible:outline-red-500'
    : 'inline-flex flex-1 justify-center rounded-full bg-sky-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-sky-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:bg-sky-500 dark:shadow-none dark:hover:bg-sky-400 dark:focus-visible:outline-sky-500'
)

const handleConfirm = () => {
  emit('confirm')
}

const handleCancel = () => {
  emit('cancel')
}
</script>
