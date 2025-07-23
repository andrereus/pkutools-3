<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useStore } from '../../stores/index'
import { getDatabase, ref as dbRef, push, remove, update } from 'firebase/database'
import { format, parseISO, formatISO, subMonths, subWeeks } from 'date-fns'
import { enUS, de, fr, es } from 'date-fns/locale'
import enChart from 'apexcharts/dist/locales/en.json'
import deChart from 'apexcharts/dist/locales/de.json'
import frChart from 'apexcharts/dist/locales/fr.json'
import esChart from 'apexcharts/dist/locales/es.json'
import { BadgeCheck, BadgeMinus } from 'lucide-vue-next'

import DataTable from '../components/DataTable.vue'
import ModalDialog from '../components/ModalDialog.vue'
import PrimaryButton from '../components/PrimaryButton.vue'
import NumberInput from '../components/NumberInput.vue'
import SecondaryButton from '../components/SecondaryButton.vue'
import DateInput from '../components/DateInput.vue'
import TextInput from '../components/TextInput.vue'
import PageHeader from '../components/PageHeader.vue'
import PheDiaryCard from '../components/PheDiaryCard.vue'

const store = useStore()
const { t, locale: i18nLocale } = useI18n()
const dialog = ref(null)
const dialog2 = ref(null)
const config = useRuntimeConfig()

// Reactive state
const editedIndex = ref(-1)
const editedKey = ref(null)

const defaultItem = {
  date: format(new Date(), 'yyyy-MM-dd'),
  phe: null,
  kcal: null
}

const editedItem = ref({ ...defaultItem })

const selection = ref('all')
const chartRef = ref(null)

// Computed properties
const userIsAuthenticated = computed(() => store.user !== null)
const user = computed(() => store.user)
const pheDiary = computed(() => store.pheDiary)
const settings = computed(() => store.settings)

const license = computed(() => settings.value.license === config.public.pkutoolsLicenseKey)

const tableHeaders = computed(() => [
  { key: 'date', title: t('phe-diary.date') },
  { key: 'phe', title: t('common.phe') },
  { key: 'kcal', title: t('common.kcal') }
])

const tableHeaders2 = computed(() => [
  { key: 'food', title: t('common.food') },
  { key: 'phe', title: t('common.phe') },
  { key: 'kcal', title: t('common.kcal') }
])

const formTitle = computed(() => {
  return editedIndex.value === -1 ? t('common.add') : t('common.edit')
})

const graph = computed(() => {
  let newPheDiary = pheDiary.value
  let chartPheDiary = newPheDiary
    .map((obj) => {
      return { x: obj.date, y: obj.phe }
    })
    .sort((a, b) => {
      return parseISO(a.x) - parseISO(b.x)
    })
  return [
    {
      name: 'Phe',
      data: chartPheDiary
    }
  ]
})

const chartOptions = computed(() => {
  let en = enChart
  let de = deChart
  let fr = frChart
  let es = esChart
  return {
    chart: {
      locales: [en, de, fr, es],
      defaultLocale: i18nLocale.value,
      toolbar: {
        tools: {
          zoom: false,
          zoomin: false,
          zoomout: false,
          reset: false
        },
        export: {
          csv: {
            filename: 'PKU Tools - Chart Data',
            headerCategory: 'Date',
            headerValue: 'Total Phe',
            dateFormatter(timestamp) {
              return timestamp
            }
          },
          svg: {
            filename: 'PKU Tools - Chart'
          },
          png: {
            filename: 'PKU Tools - Chart'
          }
        },
        autoSelected: 'pan'
      },
      zoom: {
        enabled: true
      },
      background: 'transparent'
    },
    stroke: {
      curve: 'smooth'
    },
    markers: {
      size: 1
    },
    grid: {
      show: false
    },
    dataLabels: {
      enabled: false
    },
    xaxis: {
      type: 'datetime'
    },
    yaxis: {
      min: 0
    },
    annotations: {
      yaxis: [
        {
          y: settings.value.maxPhe || 0,
          borderWidth: 2,
          borderColor: '#3498db',
          strokeDashArray: 6
        }
      ]
    },
    theme: {
      mode: document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    },
    colors: ['#3498db']
  }
})

const newestDate = computed(() => {
  if (!pheDiary.value.length) return new Date()
  return pheDiary.value.reduce((newest, entry) => {
    const entryDate = parseISO(entry.date)
    return entryDate > newest ? entryDate : newest
  }, parseISO(pheDiary.value[0].date))
})

const oldestDate = computed(() => {
  if (!pheDiary.value.length) return new Date()
  return pheDiary.value.reduce((oldest, entry) => {
    const entryDate = parseISO(entry.date)
    return entryDate < oldest ? entryDate : oldest
  }, parseISO(pheDiary.value[0].date))
})

const sortedPheDiary = computed(() => {
  return [...pheDiary.value].sort((a, b) => {
    return parseISO(a.date) - parseISO(b.date)
  })
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

const editItem = (item) => {
  editedIndex.value = pheDiary.value.indexOf(item)
  editedKey.value = item['.key']
  editedItem.value = JSON.parse(JSON.stringify(item))
  dialog.value.openDialog()
}

const deleteItem = () => {
  let r = confirm(t('common.delete') + '?')
  if (r === true) {
    const db = getDatabase()
    remove(dbRef(db, `${user.value.id}/pheDiary/${editedKey.value}`))
    close()
  }
}

const close = () => {
  dialog.value.closeDialog()
  editedItem.value = { ...defaultItem }
  editedIndex.value = -1
  editedKey.value = null
}

const save = () => {
  const db = getDatabase()
  if (editedIndex.value > -1) {
    if (editedItem.value.log) {
      update(dbRef(db, `${user.value.id}/pheDiary/${editedKey.value}`), {
        date: editedItem.value.date,
        phe: Number(editedItem.value.phe),
        log: editedItem.value.log,
        kcal: Number(editedItem.value.kcal)
      })
    } else {
      update(dbRef(db, `${user.value.id}/pheDiary/${editedKey.value}`), {
        date: editedItem.value.date,
        phe: Number(editedItem.value.phe),
        kcal: Number(editedItem.value.kcal)
      })
    }
  } else {
    if (
      pheDiary.value.length >= 30 &&
      settings.value.license !== config.public.pkutoolsLicenseKey
    ) {
      alert(t('app.limit'))
    } else {
      push(dbRef(db, `${user.value.id}/pheDiary`), {
        date: editedItem.value.date,
        phe: Number(editedItem.value.phe),
        kcal: Number(editedItem.value.kcal)
      })
    }
  }
  close()
}

// Start add/edit log

const editedLogIndex = ref(-1)

const defaultLogItem = {
  name: '',
  emoji: null,
  icon: null,
  pheReference: null,
  kcalReference: null,
  weight: null,
  phe: null,
  kcal: null
}

const editedLogItem = ref({ ...defaultLogItem })

const logFormTitle = computed(() => {
  return editedLogIndex.value === -1 ? t('common.add') : t('common.edit')
})

const calculatePhe = () => {
  return Math.round((editedLogItem.value.weight * editedLogItem.value.pheReference) / 100) || 0
}

const calculateKcal = () => {
  return Math.round((editedLogItem.value.weight * editedLogItem.value.kcalReference) / 100) || 0
}

const editLogItem = (item, index) => {
  editedLogIndex.value = index
  editedLogItem.value = { ...item }
  dialog2.value.openDialog()
}

const deleteLogItem = () => {
  editedItem.value.log.splice(editedLogIndex.value, 1)
  editedItem.value.phe = editedItem.value.log.reduce((sum, item) => sum + (item.phe || 0), 0)
  editedItem.value.kcal = editedItem.value.log.reduce((sum, item) => sum + (item.kcal || 0), 0)
  dialog2.value.closeDialog()
}

const closeLogEdit = () => {
  dialog2.value.closeDialog()
  editedLogItem.value = { ...defaultLogItem }
  editedLogIndex.value = -1
}

const saveLogEdit = () => {
  const updatedItem = {
    name: editedLogItem.value.name,
    emoji: editedLogItem.value.emoji || null,
    icon: editedLogItem.value.icon || null,
    pheReference: Number(editedLogItem.value.pheReference) || 0,
    kcalReference: Number(editedLogItem.value.kcalReference) || 0,
    weight: Number(editedLogItem.value.weight),
    phe: calculatePhe(),
    kcal: calculateKcal()
  }

  if (editedLogIndex.value > -1) {
    editedItem.value.log[editedLogIndex.value] = updatedItem
  } else {
    editedItem.value.log.push(updatedItem)
  }

  editedItem.value.phe = editedItem.value.log.reduce((sum, item) => sum + (item.phe || 0), 0)
  editedItem.value.kcal = editedItem.value.log.reduce((sum, item) => sum + (item.kcal || 0), 0)
  closeLogEdit()
}

// End add/edit log

const getlocalDate = (date) => {
  if (date) {
    const locales = { enUS, de, fr, es }
    return format(parseISO(date), 'eee P', { locale: locales[i18nLocale.value] })
  } else {
    return ''
  }
}

const escapeCSV = (value) => {
  if (value === null || value === undefined) return ''
  return `"${value.toString().replace(/"/g, '""')}"`
}

const exportAllFoodItems = () => {
  let r = confirm(t('phe-diary.export-food') + '?')
  if (r === true) {
    let csvContent = 'data:text/csv;charset=utf-8,'
    csvContent += 'Date,Name,Weight,Phe,Kcal\n'

    pheDiary.value.forEach((diaryEntry) => {
      const date = formatISO(parseISO(diaryEntry.date), { representation: 'date' })
      if (diaryEntry.log && diaryEntry.log.length > 0) {
        diaryEntry.log.forEach((logEntry) => {
          const row =
            [
              escapeCSV(date),
              escapeCSV(logEntry.name),
              escapeCSV(logEntry.weight),
              escapeCSV(logEntry.phe),
              escapeCSV(logEntry.kcal)
            ].join(',') + '\n'
          csvContent += row
        })
      }
    })
    triggerDownload(csvContent)
  }
}

const exportDailyPheTotals = () => {
  let r = confirm(t('phe-diary.export-days') + '?')
  if (r === true) {
    let csvContent = 'data:text/csv;charset=utf-8,'
    csvContent += 'Date,Total Phe,Total Kcal\n'

    pheDiary.value.forEach((diaryEntry) => {
      const date = formatISO(parseISO(diaryEntry.date), { representation: 'date' })
      const row =
        [escapeCSV(date), escapeCSV(diaryEntry.phe), escapeCSV(diaryEntry.kcal)].join(',') + '\n'
      csvContent += row
    })
    triggerDownload(csvContent)
  }
}

const triggerDownload = (csvContent) => {
  const encodedUri = encodeURI(csvContent)
  const link = document.createElement('a')
  link.setAttribute('href', encodedUri)
  link.setAttribute('download', t('phe-diary.export-filename') + '.csv')
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const updateData = (timeline) => {
  selection.value = timeline

  switch (timeline) {
    case 'all':
      chartRef.value.chart.zoomX(oldestDate.value.getTime(), newestDate.value.getTime())
      break
    case 'one_week':
      chartRef.value.chart.zoomX(
        subWeeks(newestDate.value, 1).getTime(),
        newestDate.value.getTime()
      )
      break
    case 'two_weeks':
      chartRef.value.chart.zoomX(
        subWeeks(newestDate.value, 2).getTime(),
        newestDate.value.getTime()
      )
      break
    case 'one_month':
      chartRef.value.chart.zoomX(
        subMonths(newestDate.value, 1).getTime(),
        newestDate.value.getTime()
      )
      break
    case 'three_months':
      chartRef.value.chart.zoomX(
        subMonths(newestDate.value, 3).getTime(),
        newestDate.value.getTime()
      )
      break
  }
}
</script>

<template>
  <div>
    <header>
      <PageHeader :title="$t('phe-diary.tab-title')" class="inline-block" />
    </header>

    <div v-if="!userIsAuthenticated">
      <SecondaryButton :text="$t('app.signin-google')" @click="signInGoogle" />
      <br />
      <NuxtLink
        type="button"
        :to="$localePath('email-auth')"
        class="rounded-sm bg-black/5 dark:bg-white/15 px-2 py-1 text-sm font-semibold text-gray-900 dark:text-gray-300 shadow-xs hover:bg-black/10 dark:hover:bg-white/10 mr-3 mb-6"
      >
        {{ $t('email-auth.title') }}
      </NuxtLink>
    </div>

    <div v-if="userIsAuthenticated">
      <p v-if="pheDiary.length < 2" class="mb-6">{{ $t('phe-diary.chart-info') }}</p>

      <div v-if="pheDiary.length >= 2">
        <div class="flex gap-2 mb-4">
          <button
            v-for="(period, idx) in ['all', 'one_week', 'two_weeks', 'one_month', 'three_months']"
            :key="idx"
            @click="updateData(period)"
            :class="[
              'px-3 py-1 text-sm rounded-md',
              selection === period
                ? 'bg-black/5 dark:bg-white/15'
                : 'text-gray-700 dark:text-gray-300'
            ]"
          >
            {{
              period === 'one_week'
                ? '1W'
                : period === 'two_weeks'
                  ? '2W'
                  : period === 'one_month'
                    ? '1M'
                    : period === 'three_months'
                      ? '3M'
                      : 'ALL'
            }}
          </button>
        </div>

        <apexchart
          ref="chartRef"
          type="area"
          height="250"
          :options="chartOptions"
          :series="graph"
          class="-mb-2"
        ></apexchart>
      </div>

      <PheDiaryCard />

      <!-- TODO: Add sort feature -->
      <DataTable :headers="tableHeaders" class="mb-8">
        <tr
          v-for="(item, index) in sortedPheDiary"
          :key="index"
          @click="editItem(item)"
          class="cursor-pointer"
        >
          <td class="py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-gray-300 sm:pl-6">
            {{ getlocalDate(item.date) }}
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
        @close="close"
      >
        <DateInput id-name="date" :label="$t('phe-diary.date')" v-model="editedItem.date" />

        <div class="flex gap-4">
          <NumberInput
            id-name="total-phe"
            :label="$t('phe-diary.phe')"
            v-model.number="editedItem.phe"
            class="flex-1"
          />
          <NumberInput
            id-name="kcal"
            :label="$t('common.total-kcal')"
            v-model.number="editedItem.kcal"
            class="flex-1"
          />
        </div>

        <div v-if="editedItem.log" class="flex justify-between items-center -mb-3">
          <h4 class="text-sm font-medium">
            {{ $t('phe-log.title') }}
          </h4>
          <SecondaryButton
            :text="$t('common.add')"
            @click="$refs.dialog2.openDialog()"
            class="mr-0! mb-0!"
          />
        </div>

        <DataTable v-if="editedItem.log" :headers="tableHeaders2" class="mb-3">
          <tr
            v-for="(item, index) in editedItem.log"
            :key="index"
            @click="editLogItem(item, index)"
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
                v-if="(item.icon === undefined || item.icon === '') && item.emoji === undefined"
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
              {{ item.phe }}
            </td>
            <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
              {{ item.kcal }}
            </td>
          </tr>
        </DataTable>
      </ModalDialog>

      <ModalDialog
        ref="dialog2"
        :title="logFormTitle"
        :buttons="[
          { label: $t('common.save'), type: 'submit', visible: true },
          { label: $t('common.delete'), type: 'delete', visible: editedLogIndex !== -1 },
          { label: $t('common.cancel'), type: 'close', visible: true }
        ]"
        @submit="saveLogEdit"
        @delete="deleteLogItem"
        @close="closeLogEdit"
      >
        <TextInput id-name="food" :label="$t('common.food-name')" v-model="editedLogItem.name" />
        <div class="flex gap-4">
          <NumberInput
            id-name="phe"
            :label="$t('common.phe-per-100g')"
            v-model.number="editedLogItem.pheReference"
            class="flex-1"
          />
          <NumberInput
            id-name="kcalRef"
            :label="$t('common.kcal-per-100g')"
            v-model.number="editedLogItem.kcalReference"
            class="flex-1"
          />
        </div>
        <NumberInput
          id-name="weight"
          :label="$t('common.consumed-weight')"
          v-model.number="editedLogItem.weight"
        />
        <div class="flex gap-4 mt-4">
          <span class="flex-1 ml-1">= {{ calculatePhe() }} mg Phe</span>
          <span class="flex-1 ml-1">= {{ calculateKcal() }} {{ $t('common.kcal') }}</span>
        </div>
      </ModalDialog>

      <SecondaryButton
        v-if="license"
        :text="$t('phe-diary.export-food')"
        @click="exportAllFoodItems"
      />
      <SecondaryButton
        v-if="license"
        :text="$t('phe-diary.export-days')"
        @click="exportDailyPheTotals"
      />

      <p v-if="!license" class="mt-3 text-sm">
        <NuxtLink :to="$localePath('settings')">
          <BadgeMinus class="h-5 w-5 inline-block mr-1" aria-hidden="true" />
          {{ $t('app.limited') }}
        </NuxtLink>
      </p>
      <p v-if="license" class="mt-3 text-sm">
        <BadgeCheck class="h-5 w-5 text-sky-500 inline-block mr-1" aria-hidden="true" />
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
