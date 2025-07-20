<script setup>
defineProps(['headers'])
</script>

<template>
  <div class="mt-6 flow-root">
    <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
      <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
        <div
          class="overflow-hidden shadow-sm ring-1 ring-gray-300 dark:ring-gray-800 ring-opacity-5 sm:rounded-lg"
        >
          <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
            <thead class="bg-gray-50 dark:bg-gray-950">
              <tr>
                <th
                  v-for="(header, index) in headers"
                  :key="header.key"
                  scope="col"
                  :class="[
                    'py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-300',
                    index === 0 ? 'pl-4 pr-3 sm:pl-6' : 'px-3'
                  ]"
                >
                  {{ header.title }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
              <slot />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
