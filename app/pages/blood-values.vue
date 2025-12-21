<script setup>
import { useStore } from '../../stores/index'
import { format, parseISO, formatISO } from 'date-fns'
import { enUS, de, fr, es } from 'date-fns/locale'
import enChart from 'apexcharts/dist/locales/en.json'
import deChart from 'apexcharts/dist/locales/de.json'
import frChart from 'apexcharts/dist/locales/fr.json'
import esChart from 'apexcharts/dist/locales/es.json'

const store = useStore()
const { t, locale: i18nLocale } = useI18n()
const dialog = ref(null)
const notifications = useNotifications()
const confirm = useConfirm()
const { isPremium } = useLicense()
const { saveLabValue, updateLabValue, deleteLabValue } = useSave()

// Reactive state
const editedIndex = ref(-1)
const editedKey = ref(null)

const defaultItem = {
  date: format(new Date(), 'yyyy-MM-dd'),
  phe: null,
  tyrosine: null
}

const editedItem = ref({ ...defaultItem })

// Computed properties
const userIsAuthenticated = computed(() => store.user !== null)
const labValues = computed(() => store.labValues)
const settings = computed(() => store.settings)

const license = computed(() => isPremium.value)

const tableHeaders = computed(() => [
  { key: 'date', title: t('blood-values.date') },
  { key: 'phe', title: t('blood-values.phe') },
  { key: 'tyrosine', title: t('blood-values.tyrosine') }
])

const formTitle = computed(() => {
  return editedIndex.value === -1 ? t('common.add') : t('common.edit')
})

const graph = computed(() => {
  const newLabValues = labValues.value
  const chartLabValues = newLabValues
    .map((obj) => {
      return { x: obj.date, y: obj.phe }
    })
    .sort((a, b) => {
      return parseISO(a.x) - parseISO(b.x)
    })
  return [
    {
      name: 'Phe',
      data: chartLabValues
    }
  ]
})

const chartOptions = computed(() => {
  const en = enChart
  const de = deChart
  const fr = frChart
  const es = esChart
  return {
    chart: {
      locales: [en, de, fr, es],
      defaultLocale: i18nLocale.value,
      toolbar: {
        export: {
          csv: {
            filename: 'PKU Tools - Chart Data',
            headerCategory: 'Date',
            headerValue: 'Phe',
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
        }
      },
      zoom: {
        enabled: false
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
    theme: {
      mode: document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    },
    colors: ['#3498db']
  }
})

const sortedLabValues = computed(() => {
  return [...labValues.value].sort((a, b) => {
    return parseISO(a.date) - parseISO(b.date)
  })
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

const editItem = (item) => {
  editedIndex.value = labValues.value.indexOf(item)
  editedKey.value = item['.key']
  editedItem.value = JSON.parse(JSON.stringify(item))
  dialog.value.openDialog()
}

const deleteItem = async () => {
  // Capture values before closing (needed for API call and undo)
  const entryKey = editedKey.value
  const deletedItem = JSON.parse(
    JSON.stringify(labValues.value.find((item) => item['.key'] === entryKey))
  )

  // Close dialog immediately for instant feedback
  close()

  try {
    await deleteLabValue({
      entryKey: entryKey
    })

    notifications.success(t('blood-values.item-deleted'), {
      undoAction: async () => {
        try {
          // Restore the item by adding it back via save API
          await saveLabValue({
            date: deletedItem.date,
            phe: deletedItem.phe,
            tyrosine: deletedItem.tyrosine
          })
        } catch (error) {
          console.error('Undo error:', error)
          notifications.error('Failed to restore item. Please add it manually.')
        }
      },
      undoLabel: t('common.undo')
    })
  } catch (error) {
    // Error handling is done in useSave composable
    console.error('Delete error:', error)
  }
}

const close = () => {
  dialog.value.closeDialog()
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
  if (editedIndex.value === -1 && labValues.value.length >= 30 && !isPremium.value) {
    notifications.error(t('app.limit'))
    return
  }

  // Capture state before closing (needed to determine if editing or adding)
  const isEditing = editedIndex.value > -1
  const entryKey = editedKey.value
  const entryDate = editedItem.value.date
  const entryPhe = editedItem.value.phe ? Number(editedItem.value.phe) : null
  const entryTyrosine = editedItem.value.tyrosine ? Number(editedItem.value.tyrosine) : null

  // Close dialog immediately for instant feedback
  close()

  if (isEditing && entryKey) {
    // Update existing entry - use update API (validates server-side with Zod)
    try {
      await updateLabValue({
        entryKey: entryKey,
        date: entryDate,
        phe: entryPhe,
        tyrosine: entryTyrosine
      })
      notifications.success(t('common.saved'))
    } catch (error) {
      // Error handling is done in useSave composable
      console.error('Update error:', error)
    }
  } else {
    // Add new entry - use save API
    try {
      await saveLabValue({
        date: entryDate,
        phe: entryPhe,
        tyrosine: entryTyrosine
      })
      notifications.success(t('common.saved'))
    } catch (error) {
      // Error handling is done in useSave composable
      console.error('Save error:', error)
    }
  }
}

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

const exportLabValues = async () => {
  const r = await confirm.confirm({
    title: t('blood-values.export'),
    message: t('common.export-description'),
    confirmLabel: t('common.export'),
    cancelLabel: t('common.cancel'),
    variant: 'default'
  })
  if (r === true) {
    let csvContent = 'data:text/csv;charset=utf-8,'
    csvContent += 'Date,Phe,Tyrosine\n'

    labValues.value.forEach((entry) => {
      const date = formatISO(parseISO(entry.date), { representation: 'date' })
      const row =
        [escapeCSV(date), escapeCSV(entry.phe), escapeCSV(entry.tyrosine)].join(',') + '\n'
      csvContent += row
    })
    triggerDownload(csvContent)
  }
}

const triggerDownload = (csvContent) => {
  const encodedUri = encodeURI(csvContent)
  const link = document.createElement('a')
  link.setAttribute('href', encodedUri)
  link.setAttribute('download', t('blood-values.export-filename') + '.csv')
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

definePageMeta({
  i18n: {
    paths: {
      en: '/blood-values',
      de: '/blutwerte',
      es: '/valores-sangre',
      fr: '/valeurs-sanguines'
    }
  }
})

useSeoMeta({
  title: () => t('blood-values.title'),
  description: () => t('blood-values.description')
})

defineOgImageComponent('NuxtSeo', {
  title: () => t('blood-values.title') + ' - PKU Tools',
  description: () => t('blood-values.description'),
  theme: '#3498db'
})
</script>

<template>
  <div>
    <header>
      <PageHeader :title="$t('blood-values.title')" />
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
      <p v-if="labValues.length < 2" class="mb-6">{{ $t('blood-values.chart-info') }}</p>

      <ClientOnly>
        <apexchart
          v-if="labValues.length >= 2"
          type="area"
          height="250"
          :options="chartOptions"
          :series="graph"
          class="-mb-2"
        />
      </ClientOnly>

      <DataTable :headers="tableHeaders" class="mb-8">
        <tr
          v-for="(item, index) in sortedLabValues"
          :key="index"
          class="cursor-pointer"
          @click="editItem(item)"
        >
          <td class="py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-gray-300 sm:pl-6">
            {{ getlocalDate(item.date) }}
          </td>
          <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
            {{ item.phe }}
          </td>
          <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
            {{ item.tyrosine }}
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
        <DateInput v-model="editedItem.date" id-name="date" :label="$t('blood-values.date')" />

        <NumberInput
          v-model.number="editedItem.phe"
          id-name="phe"
          :label="$t('blood-values.phe') + (settings.labUnit === 'mgdl' ? ' (mg/dL)' : ' (µmol/L)')"
        />

        <NumberInput
          v-model.number="editedItem.tyrosine"
          id-name="tyrosine"
          :label="
            $t('blood-values.tyrosine') + (settings.labUnit === 'mgdl' ? ' (mg/dL)' : ' (µmol/L)')
          "
        />

        <p class="text-sm mt-4">{{ $t('blood-values.unit-info') }}</p>
      </ModalDialog>

      <SecondaryButton v-if="license" :text="$t('blood-values.export')" @click="exportLabValues" />

      <p v-if="!license" class="mt-3 text-sm">
        <NuxtLink :to="$localePath('settings')">
          <LucideBadgeMinus class="h-5 w-5 inline-block mr-1" aria-hidden="true" />
          {{ $t('app.blood-values-limited') }}
        </NuxtLink>
      </p>
      <p v-if="license" class="mt-3 text-sm">
        <LucideBadgeCheck class="h-5 w-5 text-sky-500 inline-block mr-1" aria-hidden="true" />
        {{ $t('app.unlimited') }}
      </p>
    </div>
  </div>
</template>
