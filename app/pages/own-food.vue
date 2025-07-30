<script setup>
import { useStore } from '../../stores/index'
import { getDatabase, ref as dbRef, push, remove, update } from 'firebase/database'
import foodIcons from '~/assets/data/food-icons-map.json'
import { format } from 'date-fns'

const store = useStore()
const { t } = useI18n()
const dialog = ref(null)
const dialog2 = ref(null)
const config = useRuntimeConfig()
const localePath = useLocalePath()

// Reactive state
const editedIndex = ref(-1)
const editedKey = ref(null)
const weight = ref(100)

const defaultItem = {
  name: '',
  icon: null,
  phe: null,
  kcal: null
}

const editedItem = ref({ ...defaultItem })

// Computed properties
const userIsAuthenticated = computed(() => store.user !== null)
const user = computed(() => store.user)
const ownFood = computed(() => store.ownFood)
const settings = computed(() => store.settings)

const license = computed(() => settings.value.license === config.public.pkutoolsLicenseKey)

const tableHeaders = computed(() => [
  { key: 'food', title: t('common.food') },
  { key: 'phe', title: t('common.phe') },
  { key: 'kcal', title: t('common.kcal') }
])

const formTitle = computed(() => {
  return editedIndex.value === -1 ? t('common.add') : t('common.edit')
})

// Methods
const signInGoogle = async () => {
  try {
    await store.signInGoogle()
  } catch (error) {
    alert(t('app.auth-error'))
    console.error(error)
  }
}

const editItem = () => {
  dialog2.value.closeDialog()
  dialog.value.openDialog()
}

const deleteItem = () => {
  const db = getDatabase()
  remove(dbRef(db, `${user.value.id}/ownFood/${editedKey.value}`))
  closeModal()
}

const closeModal = () => {
  dialog.value.closeDialog()
  dialog2.value.closeDialog()
  editedItem.value = { ...defaultItem }
  editedIndex.value = -1
  editedKey.value = null
}

const save = () => {
  const db = getDatabase()
  if (editedIndex.value > -1) {
    update(dbRef(db, `${user.value.id}/ownFood/${editedKey.value}`), {
      name: editedItem.value.name,
      icon: editedItem.value.icon || null,
      phe: Number(editedItem.value.phe),
      kcal: Number(editedItem.value.kcal) || 0
    })
  } else {
    if (ownFood.value.length >= 50 && settings.value.license !== config.public.pkutoolsLicenseKey) {
      alert(t('app.limit'))
    } else {
      push(dbRef(db, `${user.value.id}/ownFood`), {
        name: editedItem.value.name,
        icon: editedItem.value.icon || null,
        phe: Number(editedItem.value.phe),
        kcal: Number(editedItem.value.kcal) || 0
      })
    }
  }
  closeModal()
}

const addItem = (item) => {
  weight.value = 100
  editedIndex.value = ownFood.value.indexOf(item)
  editedKey.value = item['.key']
  editedItem.value = { ...item }
  dialog2.value.openDialog()
}

const calculatePhe = () => {
  return Math.round((weight.value * editedItem.value.phe) / 100)
}

const calculateKcal = () => {
  return Math.round((weight.value * editedItem.value.kcal) / 100) || 0
}

const add = () => {
  const db = getDatabase()
  const logEntry = {
    name: editedItem.value.name,
    icon: editedItem.value.icon || null,
    pheReference: editedItem.value.phe,
    kcalReference: editedItem.value.kcal,
    weight: Number(weight.value),
    phe: calculatePhe(),
    kcal: calculateKcal()
  }

  const today = new Date()
  const formattedDate = format(today, 'yyyy-MM-dd')
  const todayEntry = store.pheDiary.find((entry) => entry.date === formattedDate)

  if (todayEntry) {
    const updatedLog = [...(todayEntry.log || []), logEntry]
    const totalPhe = updatedLog.reduce((sum, item) => sum + (item.phe || 0), 0)
    const totalKcal = updatedLog.reduce((sum, item) => sum + (item.kcal || 0), 0)
    update(dbRef(db, `${user.value.id}/pheDiary/${todayEntry['.key']}`), {
      log: updatedLog,
      phe: totalPhe,
      kcal: totalKcal
    })
  } else {
    push(dbRef(db, `${user.value.id}/pheDiary`), {
      date: formattedDate,
      phe: calculatePhe(),
      kcal: calculateKcal(),
      log: [logEntry]
    })
  }
  dialog2.value.closeDialog()
  navigateTo(localePath('diary'))
}

const escapeCSV = (value) => {
  if (value === null || value === undefined) return ''
  return `"${value.toString().replace(/"/g, '""')}"`
}

const exportOwnFood = () => {
  let r = confirm(t('common.export') + '?')
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
        {{ $t('sign-in.title') }}
      </NuxtLink>
    </div>

    <div v-if="userIsAuthenticated">
      <p class="mb-6">{{ $t('own-food.search-info') }}</p>

      <DataTable :headers="tableHeaders" class="mb-8">
        <tr
          v-for="(item, index) in ownFood"
          :key="index"
          @click="addItem(item)"
          class="cursor-pointer"
        >
          <td class="py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-gray-300 sm:pl-6">
            <img
              :src="'/images/food-icons/' + item.icon + '.svg'"
              v-if="item.icon !== undefined && item.icon !== ''"
              onerror="this.src='/images/food-icons/organic-food.svg'"
              width="25"
              class="food-icon"
              alt="Food Icon"
            />
            <img
              :src="'/images/food-icons/organic-food.svg'"
              v-if="item.icon === undefined || item.icon === ''"
              width="25"
              class="food-icon"
              alt="Food Icon"
            />
            {{ item.name }}
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
              :src="'/images/food-icons/' + editedItem.icon + '.svg'"
              v-if="editedItem.icon !== undefined && editedItem.icon !== null"
              width="30"
              class="food-icon float-left"
              alt="Food Icon"
            />
            <img
              :src="'/images/food-icons/organic-food.svg'"
              v-if="editedItem.icon === undefined || editedItem.icon === null"
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
                  :src="'/images/food-icons/' + item.svg + '.svg'"
                  v-if="item.svg !== undefined"
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
          id-name="food"
          :label="$t('common.food-name')"
          v-model="editedItem.name"
          class="mt-2"
        />
        <div class="flex gap-4">
          <NumberInput
            id-name="phe"
            :label="$t('common.phe-per-100g')"
            v-model.number="editedItem.phe"
            class="flex-1"
          />
          <NumberInput
            id-name="kcal"
            :label="$t('common.kcal-per-100g')"
            v-model.number="editedItem.kcal"
            class="flex-1"
          />
        </div>
      </ModalDialog>

      <SecondaryButton v-if="license" :text="$t('common.export')" @click="exportOwnFood" />

      <p v-if="!license" class="mt-3 text-sm">
        <NuxtLink :to="$localePath('settings')">
          <LucideBadgeMinus class="h-5 w-5 inline-block mr-1" aria-hidden="true" />
          {{ $t('app.limited') }}
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
        <NumberInput id-name="weight" :label="$t('common.weight-in-g')" v-model.number="weight" />
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
