<script setup>
import { useStore } from '../../stores/index'
import foodIcons from '~/assets/data/food-icons-map.json'
import Fuse from 'fuse.js'
import { format } from 'date-fns'

const store = useStore()
const { t } = useI18n()
const dialog = ref(null)
const dialog2 = ref(null)
const localePath = useLocalePath()
const notifications = useNotifications()
const confirm = useConfirm()
const { isPremium } = useLicense()
const { saveOwnFood, saveDiaryEntry, updateOwnFood, deleteOwnFood } = useSave()

// Reactive state
const search = ref('')
const editedIndex = ref(-1)
const editedKey = ref(null)
const weight = ref(100)
const selectedDate = ref(format(new Date(), 'yyyy-MM-dd'))

const defaultItem = {
  name: '',
  icon: null,
  phe: null,
  kcal: null
}

const editedItem = ref({ ...defaultItem })

// Computed properties
const userIsAuthenticated = computed(() => store.user !== null)
const ownFood = computed(() => store.ownFood)

const license = computed(() => isPremium.value)

const tableHeaders = computed(() => [
  { key: 'food', title: t('common.food') },
  { key: 'phe', title: t('common.phe') },
  { key: 'kcal', title: t('common.kcal') }
])

const formTitle = computed(() => {
  return editedIndex.value === -1 ? t('common.add') : t('common.edit')
})

const filteredOwnFood = computed(() => {
  if (!search.value.trim()) {
    return ownFood.value
  }

  const fuse = new Fuse(ownFood.value, {
    keys: ['name', 'phe'],
    threshold: 0.2,
    minMatchCharLength: 2,
    ignoreLocation: true,
    useExtendedSearch: true
  })

  const results = fuse.search(search.value.trim())
  return results.map((result) => result.item)
})

// Methods
const signInGoogle = async () => {
  try {
    await store.signInGoogle()
  } catch (error) {
    notifications.error(t('app.auth-error'))
    console.error(error)
  }
}

const editItem = () => {
  dialog2.value.closeDialog()
  dialog.value.openDialog()
}

const deleteItem = async () => {
  // Store deleted item for undo
  const deletedItem = JSON.parse(
    JSON.stringify(ownFood.value.find((item) => item['.key'] === editedKey.value))
  )

  try {
    await deleteOwnFood({
      entryKey: editedKey.value
    })

    notifications.success(t('own-food.item-deleted'), {
      undoAction: async () => {
        try {
          // Restore the item by adding it back via save API
          await saveOwnFood({
            name: deletedItem.name,
            icon: deletedItem.icon || null,
            phe: deletedItem.phe,
            kcal: deletedItem.kcal
          })
        } catch (error) {
          console.error('Undo error:', error)
          notifications.error('Failed to restore item. Please add it manually.')
        }
      },
      undoLabel: t('common.undo')
    })
    closeModal()
  } catch (error) {
    // Error handling is done in useSave composable
    console.error('Delete error:', error)
  }
}

const closeModal = () => {
  dialog.value.closeDialog()
  dialog2.value.closeDialog()
  editedItem.value = { ...defaultItem }
  editedIndex.value = -1
  editedKey.value = null
}

const save = async () => {
  if (!store.user || store.settings.healthDataConsent !== true) {
    notifications.error(t('health-consent.no-consent'))
    return
  }

  // Check limit before closing (for better UX)
  if (editedIndex.value === -1 && ownFood.value.length >= 50 && !isPremium.value) {
    notifications.error(t('app.limit'))
    return
  }

  // Close modal immediately for instant feedback
  closeModal()

  if (editedIndex.value > -1) {
    // Update existing entry - use update API (validates server-side with Zod)
    try {
      await updateOwnFood({
        entryKey: editedKey.value,
        name: editedItem.value.name,
        icon: editedItem.value.icon || null,
        phe: Number(editedItem.value.phe),
        kcal: Number(editedItem.value.kcal) || 0
      })
      notifications.success(t('common.saved'))
    } catch (error) {
      // Error handling is done in useSave composable
      console.error('Update error:', error)
    }
  } else {
    // Add new entry - use save API
    try {
      await saveOwnFood({
        name: editedItem.value.name,
        icon: editedItem.value.icon || null,
        phe: Number(editedItem.value.phe),
        kcal: Number(editedItem.value.kcal) || 0
      })
      notifications.success(t('common.saved'))
    } catch (error) {
      // Error handling is done in useSave composable
      console.error('Save error:', error)
    }
  }
}

const addItem = (item) => {
  weight.value = 100
  editedIndex.value = ownFood.value.indexOf(item)
  editedKey.value = item['.key']
  editedItem.value = { ...item }
  selectedDate.value = format(new Date(), 'yyyy-MM-dd')
  dialog2.value.openDialog()
}

const calculatePhe = () => {
  return Math.round((weight.value * editedItem.value.phe) / 100)
}

const calculateKcal = () => {
  return Math.round((weight.value * editedItem.value.kcal) / 100) || 0
}

const add = async () => {
  if (!store.user || store.settings.healthDataConsent !== true) {
    notifications.error(t('health-consent.no-consent'))
    return
  }

  const logEntry = {
    name: editedItem.value.name,
    icon: editedItem.value.icon || null,
    emoji: null,
    pheReference: editedItem.value.phe,
    kcalReference: editedItem.value.kcal || 0,
    weight: Number(weight.value),
    phe: calculatePhe(),
    kcal: calculateKcal()
  }

  // Use server API for all writes - validates with Zod
  try {
    await saveDiaryEntry({
      date: selectedDate.value,
      ...logEntry
    })
    notifications.success(t('common.saved'))
    dialog2.value.closeDialog()
    navigateTo(localePath('diary'))
  } catch (error) {
    // Error handling is done in useSave composable
    console.error('Save error:', error)
  }
}

const escapeCSV = (value) => {
  if (value === null || value === undefined) return ''
  return `"${value.toString().replace(/"/g, '""')}"`
}

const exportOwnFood = async () => {
  const r = await confirm.confirm({
    title: t('common.export'),
    message: t('common.export-description'),
    confirmLabel: t('common.export'),
    cancelLabel: t('common.cancel'),
    variant: 'default'
  })
  if (r === true) {
    let csvContent = 'data:text/csv;charset=utf-8,'
    csvContent += 'Name,Phe per 100g,Kcal per 100g\n'

    ownFood.value.forEach((entry) => {
      const row =
        [escapeCSV(entry.name), escapeCSV(entry.phe), escapeCSV(entry.kcal)].join(',') + '\n'
      csvContent += row
    })
    triggerDownload(csvContent)
  }
}

const triggerDownload = (csvContent) => {
  const encodedUri = encodeURI(csvContent)
  const link = document.createElement('a')
  link.setAttribute('href', encodedUri)
  link.setAttribute('download', t('own-food.export-filename') + '.csv')
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const setIcon = (item, close) => {
  editedItem.value.icon = item.svg
  close()
}

definePageMeta({
  i18n: {
    paths: {
      en: '/own-food',
      de: '/eigene-lebensmittel',
      es: '/alimentos-propios',
      fr: '/aliments-personnels'
    }
  }
})

useSeoMeta({
  title: () => t('own-food.title'),
  description: () => t('own-food.description')
})

defineOgImageComponent('NuxtSeo', {
  title: () => t('own-food.title') + ' - PKU Tools',
  description: () => t('own-food.description'),
  theme: '#3498db'
})
</script>

<template>
  <div>
    <header>
      <PageHeader :title="$t('own-food.title')" />
    </header>

    <div v-if="!userIsAuthenticated">
      <SecondaryButton :text="$t('app.signin-google')" @click="signInGoogle" />
      <br />
      <NuxtLink
        type="button"
        :to="$localePath('sign-in')"
        class="rounded-sm bg-black/5 dark:bg-white/15 px-2 py-1 text-sm font-semibold text-gray-900 dark:text-gray-300 shadow-xs hover:bg-black/10 dark:hover:bg-white/10 mr-3 mb-6"
      >
        {{ $t('sign-in.signin-with-email') }}
      </NuxtLink>
    </div>

    <div v-if="userIsAuthenticated">
      <div class="w-full mb-6">
        <label for="search" class="sr-only">{{ $t('food-search.search') }}</label>
        <div class="relative">
          <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <LucideSearch class="h-5 w-5 text-gray-400" aria-hidden="true" />
          </div>
          <input
            id="search"
            v-model="search"
            type="search"
            name="search"
            :placeholder="$t('food-search.search')"
            autocomplete="off"
            class="block w-full rounded-md border-0 bg-white py-1.5 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-sky-500 sm:text-sm sm:leading-6 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600 dark:focus:ring-sky-500"
          />
        </div>
      </div>

      <DataTable :headers="tableHeaders" class="mb-8">
        <tr
          v-for="(item, index) in filteredOwnFood"
          :key="index"
          class="cursor-pointer"
          @click="addItem(item)"
        >
          <td class="py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-gray-300 sm:pl-6">
            <span class="flex items-center gap-1">
              <img
                v-if="item.icon !== undefined && item.icon !== null && item.icon !== ''"
                :src="'/images/food-icons/' + item.icon + '.svg'"
                onerror="this.src='/images/food-icons/organic-food.svg'"
                width="25"
                class="food-icon"
                alt="Food Icon"
              />
              <img
                v-if="item.icon === undefined || item.icon === null || item.icon === ''"
                :src="'/images/food-icons/organic-food.svg'"
                width="25"
                class="food-icon"
                alt="Food Icon"
              />
              {{ item.name }}
            </span>
          </td>
          <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
            {{ item.phe }}
          </td>
          <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
            {{ item.kcal }}
          </td>
        </tr>
      </DataTable>

      <PrimaryButton :text="$t('common.add')" @click="$refs.dialog.openDialog()" />

      <ModalDialog
        ref="dialog"
        :title="formTitle"
        :buttons="[
          { label: $t('common.save'), type: 'submit', visible: true },
          { label: $t('common.delete'), type: 'delete', visible: editedIndex !== -1 },
          { label: $t('common.cancel'), type: 'close', visible: true }
        ]"
        @submit="save"
        @delete="deleteItem"
        @close="closeModal"
      >
        <HeadlessPopover v-if="license">
          <HeadlessPopoverButton class="my-1">
            <img
              v-if="editedItem.icon !== undefined && editedItem.icon !== null"
              :src="'/images/food-icons/' + editedItem.icon + '.svg'"
              width="30"
              class="food-icon float-left"
              alt="Food Icon"
            />
            <img
              v-if="editedItem.icon === undefined || editedItem.icon === null"
              :src="'/images/food-icons/organic-food.svg'"
              width="30"
              class="food-icon float-left"
              alt="Food Icon"
            />
            <span class="float-left my-1 ml-2 text-sm">{{ $t('own-food.choose-icon') }}</span>
            <LucideChevronDown class="h-5 w-5 inline-block ml-2" aria-hidden="true" />
          </HeadlessPopoverButton>

          <transition
            enter-active-class="transition ease-out duration-200"
            enter-from-class="transform opacity-0 scale-95"
            enter-to-class="transform opacity-100 scale-100"
            leave-active-class="transition ease-in duration-75"
            leave-from-class="transform opacity-100 scale-100"
            leave-to-class="transform opacity-0 scale-95"
          >
            <HeadlessPopoverPanel v-slot="{ close }">
              <span v-for="(item, index) in foodIcons" :key="index">
                <img
                  v-if="item.svg !== undefined"
                  :src="'/images/food-icons/' + item.svg + '.svg'"
                  width="35"
                  class="food-icon pick-icon m-2"
                  alt="Food Icon"
                  @click="setIcon(item, close)"
                />
              </span>
            </HeadlessPopoverPanel>
          </transition>
        </HeadlessPopover>

        <TextInput
          v-model="editedItem.name"
          id-name="food"
          :label="$t('common.food-name')"
          class="mt-2"
        />
        <div class="flex gap-4">
          <NumberInput
            v-model.number="editedItem.phe"
            id-name="phe"
            :label="$t('common.phe-per-100g')"
            class="flex-1"
          />
          <NumberInput
            v-model.number="editedItem.kcal"
            id-name="kcal"
            :label="$t('common.kcal-per-100g')"
            class="flex-1"
          />
        </div>
      </ModalDialog>

      <SecondaryButton v-if="license" :text="$t('common.export')" @click="exportOwnFood" />

      <p v-if="!license" class="mt-3 text-sm">
        <NuxtLink :to="$localePath('settings')">
          <LucideBadgeMinus class="h-5 w-5 inline-block mr-1" aria-hidden="true" />
          {{ $t('app.own-food-limited') }}
        </NuxtLink>
      </p>
      <p v-if="license" class="mt-3 text-sm">
        <LucideBadgeCheck class="h-5 w-5 text-sky-500 inline-block mr-1" aria-hidden="true" />
        {{ $t('app.unlimited') }}
      </p>

      <ModalDialog
        ref="dialog2"
        :title="editedItem.name"
        :buttons="[
          { label: $t('common.add'), type: 'submit', visible: true },
          { label: $t('common.edit'), type: 'edit', visible: true },
          { label: $t('common.cancel'), type: 'close', visible: true }
        ]"
        @submit="add"
        @edit="editItem"
        @close="closeModal"
      >
        <DateInput
          v-if="userIsAuthenticated"
          v-model="selectedDate"
          id-name="date"
          :label="$t('common.date')"
        />
        <NumberInput v-model.number="weight" id-name="weight" :label="$t('common.weight-in-g')" />
        <div class="flex gap-4 mt-4">
          <span class="flex-1 ml-1">= {{ calculatePhe() }} mg Phe</span>
          <span class="flex-1 ml-1">= {{ calculateKcal() }} {{ $t('common.kcal') }}</span>
        </div>
      </ModalDialog>
    </div>
  </div>
</template>

<style scoped>
.food-icon {
  vertical-align: bottom;
  display: inline-block;
}

.pick-icon {
  cursor: pointer;
}
</style>
