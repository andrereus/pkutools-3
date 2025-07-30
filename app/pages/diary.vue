<script setup>
import { useStore } from '../../stores/index'
import { getDatabase, ref as dbRef, push, update } from 'firebase/database'
import { format, parseISO, subDays, addDays } from 'date-fns'

const store = useStore()
const { t } = useI18n()
const dialog2 = ref(null)
const config = useRuntimeConfig()
const localePath = useLocalePath()

// Reactive state
const editedIndex = ref(-1)
const editedKey = ref(null)
const date = ref(format(new Date(), 'yyyy-MM-dd'))
const visibleItems = ref(5)
const selectedDiaryEntry = ref(null)

const defaultItem = {
  name: '',
  emoji: null,
  icon: null,
  pheReference: null,
  kcalReference: null,
  weight: null,
  phe: null,
  kcal: null
}

const editedItem = ref({ ...defaultItem })

// Computed properties
const userIsAuthenticated = computed(() => store.user !== null)
const user = computed(() => store.user)
const pheDiary = computed(() => store.pheDiary)
const settings = computed(() => store.settings)

const license = computed(() => settings.value.license === config.public.pkutoolsLicenseKey)

const tableHeaders = computed(() => [
  { key: 'food', title: t('common.food') },
  { key: 'weight', title: t('common.weight') },
  { key: 'phe', title: t('common.phe') },
  { key: 'kcal', title: t('common.kcal') }
])

const formTitle = computed(() => {
  return editedIndex.value === -1 ? t('common.add') : t('common.edit')
})

const selectedDayLog = computed(() => {
  const entry = pheDiary.value.find((entry) => entry.date === date.value)
  return entry?.log || []
})

watch([pheDiary, date], () => {
  selectedDiaryEntry.value = pheDiary.value.find((entry) => entry.date === date.value) || null
})

const pheResult = computed(() => {
  return selectedDayLog.value.reduce((sum, item) => sum + item.phe, 0)
})

const kcalResult = computed(() => {
  return selectedDayLog.value.reduce((sum, item) => sum + (Number(item.kcal) || 0), 0)
})

const lastAdded = computed(() => {
  // Get the food items from the last diary entries that have a log
  const lastEntries = pheDiary.value
    .filter((obj) => Array.isArray(obj.log))
    .slice(-5)
    .map((obj) => obj.log)

  // Flatten and reverse the array to prioritize the most recent items
  const flattenedLogs = [].concat(...lastEntries).reverse()

  // Use a Map to filter out duplicates and keep track of their recency-weighted score
  const itemMap = new Map()

  flattenedLogs.forEach((item, index) => {
    const recencyWeight = flattenedLogs.length / (index + 1) // More recent items have higher weight
    if (itemMap.has(item.name)) {
      const entry = itemMap.get(item.name)
      entry.score += recencyWeight
    } else {
      itemMap.set(item.name, { ...item, score: recencyWeight })
    }
  })

  // Convert the Map back to an array and sort by combined score (recency-weighted frequency)
  const sortedItems = Array.from(itemMap.values()).sort((a, b) => b.score - a.score)

  // Limit to the top 10 items
  return sortedItems
})

const isToday = computed(() => date.value === format(new Date(), 'yyyy-MM-dd'))

// Methods
const signInGoogle = async () => {
  try {
    await store.signInGoogle()
  } catch (error) {
    alert(t('app.auth-error'))
    console.error(error)
  }
}

const showMoreItems = () => {
  visibleItems.value += 5
}

const calculatePhe = () => {
  return Math.round((editedItem.value.weight * editedItem.value.pheReference) / 100) || 0
}

const calculateKcal = () => {
  return Math.round((editedItem.value.weight * editedItem.value.kcalReference) / 100) || 0
}

const editItem = (item, index) => {
  editedIndex.value = index
  editedItem.value = JSON.parse(JSON.stringify(item))
  dialog2.value.openDialog()
}

const addLastAdded = (item) => {
  editedItem.value = JSON.parse(JSON.stringify(item))
  dialog2.value.openDialog()
}

const deleteItem = () => {
  const db = getDatabase()
  const updatedLog = selectedDayLog.value.filter((_, index) => index !== editedIndex.value)
  const totalPhe = updatedLog.reduce((sum, item) => sum + (item.phe || 0), 0)
  const totalKcal = updatedLog.reduce((sum, item) => sum + (item.kcal || 0), 0)

  update(dbRef(db, `${user.value.id}/pheDiary/${selectedDiaryEntry.value['.key']}`), {
    log: updatedLog,
    phe: totalPhe,
    kcal: totalKcal
  })
  close()
}

const close = () => {
  dialog2.value.closeDialog()
  editedItem.value = { ...defaultItem }
  editedIndex.value = -1
  editedKey.value = null
}

const save = () => {
  const db = getDatabase()
  const newLogEntry = {
    name: editedItem.value.name,
    emoji: editedItem.value.emoji || null,
    icon: editedItem.value.icon || null,
    pheReference: Number(editedItem.value.pheReference) || 0,
    kcalReference: Number(editedItem.value.kcalReference) || 0,
    weight: Number(editedItem.value.weight),
    phe: calculatePhe(),
    kcal: calculateKcal()
  }

  if (selectedDiaryEntry.value) {
    const updatedLog = [...selectedDayLog.value]
    if (editedIndex.value > -1) {
      // Update existing item
      updatedLog[editedIndex.value] = newLogEntry
    } else {
      // Add new item
      updatedLog.push(newLogEntry)
    }
    const totalPhe = updatedLog.reduce((sum, item) => sum + (item.phe || 0), 0)
    const totalKcal = updatedLog.reduce((sum, item) => sum + (item.kcal || 0), 0)
    update(dbRef(db, `${user.value.id}/pheDiary/${selectedDiaryEntry.value['.key']}`), {
      log: updatedLog,
      phe: totalPhe,
      kcal: totalKcal
    })
  } else {
    if (
      pheDiary.value.length >= 30 &&
      settings.value.license !== config.public.pkutoolsLicenseKey
    ) {
      alert(t('app.limit'))
    } else {
      push(dbRef(db, `${user.value.id}/pheDiary`), {
        date: date.value,
        phe: calculatePhe(),
        kcal: calculateKcal(),
        log: [newLogEntry]
      })
    }
  }
  close()
}

const prevDay = () => {
  const currentDate = parseISO(date.value)
  date.value = format(subDays(currentDate, 1), 'yyyy-MM-dd')
}

const nextDay = () => {
  const currentDate = parseISO(date.value)
  date.value = format(addDays(currentDate, 1), 'yyyy-MM-dd')
}

// Watchers
watch(userIsAuthenticated, (newVal) => {
  if (!newVal) {
    navigateTo(localePath('index'))
  }
})
</script>

<template>
  <div>
    <header>
      <PageHeader :title="$t('diary.tab-title')" class="inline-block" />
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
      <div class="flex justify-between items-center gap-4 mb-6">
        <button class="p-1 rounded-md bg-gray-100 dark:bg-gray-800 cursor-pointer" @click="prevDay">
          <LucideChevronLeft class="h-6 w-6" aria-hidden="true" />
        </button>
        <input
          id="date"
          v-model="date"
          type="date"
          name="date"
          class="flex-1 block w-full rounded-md border-0 bg-white py-1.5 text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-sky-500 sm:text-sm sm:leading-6 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600 dark:focus:ring-sky-500"
        />
        <button class="p-1 rounded-md bg-gray-100 dark:bg-gray-800 cursor-pointer" @click="nextDay">
          <LucideChevronRight class="h-6 w-6" aria-hidden="true" />
        </button>
      </div>

      <div class="mb-6 py-3 px-3 bg-gray-100 dark:bg-gray-900 rounded-md shadow-inner">
        <div class="text-sm flex justify-between">
          <span>{{ pheResult }} Phe {{ $t('app.total') }}</span>
          <span v-if="settings?.maxPhe"
            >{{ settings.maxPhe - pheResult }} Phe {{ $t('app.left') }} ({{
              Math.round(((pheResult * 100) / settings.maxPhe - 100) * -1)
            }}%)</span
          >
          <NuxtLink v-if="!settings?.maxPhe" :to="$localePath('settings')">{{
            $t('settings.title')
          }}</NuxtLink>
        </div>
        <div
          class="relative w-full bg-gray-200 dark:bg-gray-800 rounded-md overflow-hidden h-1 mt-2"
        >
          <div
            class="bg-sky-500 h-full rounded-md"
            :style="{ width: `${(pheResult * 100) / (settings?.maxPhe || 1)}%` }"
          />
        </div>
        <div class="text-sm flex justify-between mt-2">
          <span>{{ kcalResult }} {{ $t('common.kcal') }} {{ $t('app.total') }}</span>
          <span v-if="settings?.maxKcal"
            >{{ settings.maxKcal - kcalResult }} {{ $t('common.kcal') }} {{ $t('app.left') }} ({{
              Math.round(((kcalResult * 100) / settings.maxKcal - 100) * -1)
            }}%)</span
          >
          <NuxtLink v-if="!settings?.maxKcal" :to="$localePath('settings')">{{
            $t('settings.title')
          }}</NuxtLink>
        </div>
        <div
          class="relative w-full bg-gray-200 dark:bg-gray-800 rounded-md overflow-hidden h-1 mt-2"
        >
          <div
            class="bg-sky-500 h-full rounded-md"
            :style="{ width: `${(kcalResult * 100) / (settings?.maxKcal || 1)}%` }"
          />
        </div>
      </div>

      <TodaysTipCard v-if="isToday" />

      <DataTable :headers="tableHeaders" class="mb-6">
        <tr
          v-for="(item, index) in selectedDayLog"
          :key="index"
          class="cursor-pointer"
          @click="editItem(item, index)"
        >
          <td class="py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-gray-300 sm:pl-6">
            <img
              v-if="item.icon !== undefined && item.icon !== ''"
              :src="'/images/food-icons/' + item.icon + '.svg'"
              onerror="this.src='/images/food-icons/organic-food.svg'"
              width="25"
              class="food-icon"
              alt="Food Icon"
            />
            <img
              v-if="(item.icon === undefined || item.icon === '') && item.emoji === undefined"
              :src="'/images/food-icons/organic-food.svg'"
              width="25"
              class="food-icon"
              alt="Food Icon"
            />
            {{
              (item.icon === undefined || item.icon === '') && item.emoji !== undefined
                ? item.emoji
                : null
            }}
            {{ item.name }}
          </td>
          <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
            {{ item.weight }}
          </td>
          <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
            {{ item.phe }}
          </td>
          <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
            {{ item.kcal }}
          </td>
        </tr>
      </DataTable>

      <ModalDialog
        ref="dialog2"
        :title="formTitle"
        :buttons="[
          { label: $t('common.save'), type: 'submit', visible: true },
          { label: $t('common.delete'), type: 'delete', visible: editedIndex !== -1 },
          { label: $t('common.cancel'), type: 'close', visible: true }
        ]"
        @submit="save"
        @delete="deleteItem"
        @close="close"
      >
        <p v-if="!editedItem.pheReference && editedIndex !== -1" class="mb-3">
          {{ $t('diary.data-warning') }}
        </p>
        <TextInput v-model="editedItem.name" id-name="food" :label="$t('common.food-name')" />
        <div class="flex gap-4">
          <NumberInput
            v-model.number="editedItem.pheReference"
            id-name="phe"
            :label="$t('common.phe-per-100g')"
            class="flex-1"
          />
          <NumberInput
            v-model.number="editedItem.kcalReference"
            id-name="kcalRef"
            :label="$t('common.kcal-per-100g')"
            class="flex-1"
          />
        </div>
        <NumberInput
          v-model.number="editedItem.weight"
          id-name="weight"
          :label="$t('common.consumed-weight')"
        />
        <div class="flex gap-4 mt-4">
          <span class="flex-1 ml-1">= {{ calculatePhe() }} mg Phe</span>
          <span class="flex-1 ml-1">= {{ calculateKcal() }} {{ $t('common.kcal') }}</span>
        </div>
      </ModalDialog>

      <PrimaryButton :text="$t('common.add')" @click="$refs.dialog2.openDialog()" />

      <span v-if="lastAdded.length !== 0" class="mt-3">
        <SecondaryButton
          v-for="(item, index) in lastAdded.slice(0, visibleItems)"
          :key="index"
          :text="`${item.weight}g ${item.name.length > 14 ? item.name.slice(0, 13) + '…' : item.name}`"
          class="!t-font-normal"
          @click="addLastAdded(item)"
        />
        <SecondaryButton
          v-if="visibleItems < lastAdded.length"
          :text="$t('diary.more')"
          @click="showMoreItems"
        />
      </span>

      <p v-if="lastAdded.length === 0" class="mt-3">
        {{ $t('diary.info') }}
      </p>

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
    </div>
  </div>
</template>

<style scoped>
.food-icon {
  vertical-align: bottom;
  display: inline-block;
}
</style>
