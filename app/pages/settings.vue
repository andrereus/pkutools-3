<script setup>
import { useStore } from '../../stores/index'
import { getDatabase, ref as dbRef, remove, update } from 'firebase/database'
import { getAuth } from 'firebase/auth'

const store = useStore()
const { t } = useI18n()
const config = useRuntimeConfig()
const localePath = useLocalePath()

// Reactive state
const selectedTheme = ref('system')

// Computed properties
const userIsAuthenticated = computed(() => store.user !== null)
const user = computed(() => store.user)
const settings = computed(() => store.settings)

const themeOptions = computed(() => [
  { title: t('settings.theme-system'), value: 'system' },
  { title: t('settings.theme-light'), value: 'light' },
  { title: t('settings.theme-dark'), value: 'dark' }
])

const unitOptions = computed(() => [
  { title: 'mg/dL', value: 'mgdl' },
  { title: 'µmol/L', value: 'umoll' }
])

// Methods
const signInGoogle = async () => {
  try {
    await store.signInGoogle()
  } catch (error) {
    alert(t('app.auth-error'))
    console.error(error)
  }
}

const save = () => {
  const db = getDatabase()
  update(dbRef(db, `${user.value.id}/settings`), {
    maxPhe: settings.value.maxPhe || 0,
    maxKcal: settings.value.maxKcal || 0,
    labUnit: settings.value.labUnit
  }).then(() => {
    alert(t('settings.saved'))
  })
}

const saveLicense = () => {
  const db = getDatabase()
  update(dbRef(db, `${user.value.id}/settings`), {
    license: settings.value.license || ''
  }).then(() => {
    if (settings.value.license === config.public.pkutoolsLicenseKey) {
      alert(t('settings.license-active') + ' 🎉')
    } else {
      alert(t('settings.license-inactive'))
    }
  })
}

const resetDiary = () => {
  const r = confirm(t('settings.reset-diary') + '?')
  if (r === true) {
    const db = getDatabase()
    remove(dbRef(db, `${user.value.id}/pheDiary`))
    navigateTo(localePath('diet-report'))
  }
}

const resetLabValues = () => {
  const r = confirm(t('settings.reset-blood-values') + '?')
  if (r === true) {
    const db = getDatabase()
    remove(dbRef(db, `${user.value.id}/labValues`))
    navigateTo(localePath('blood-values'))
  }
}

const resetOwnFood = () => {
  const r = confirm(t('settings.reset-own-food') + '?')
  if (r === true) {
    const db = getDatabase()
    remove(dbRef(db, `${user.value.id}/ownFood`))
    navigateTo(localePath('own-food'))
  }
}

const deleteAccount = () => {
  const r = confirm(t('settings.delete-account') + '?')
  if (r === true) {
    const db = getDatabase()
    const auth = getAuth()
    remove(dbRef(db, store.user.id))
    auth.currentUser
      .delete()
      .then(() => {
        store.signOut()
        navigateTo(localePath('index'))
      })
      .catch((error) => {
        alert(t('settings.delete-account-error'))
        console.error(error)
      })
  }
}

const handleThemeChange = () => {
  if (selectedTheme.value === 'light') {
    localStorage.setItem('theme', 'light')
    document.documentElement.classList.remove('dark')
  } else if (selectedTheme.value === 'dark') {
    localStorage.setItem('theme', 'dark')
    document.documentElement.classList.add('dark')
  } else {
    localStorage.removeItem('theme')
    if (window.matchMedia('(prefers-color-scheme: dark)').matches === true) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }
}

// Lifecycle hooks
onMounted(() => {
  selectedTheme.value = localStorage.getItem('theme') || 'system'
})
</script>

<template>
  <div>
    <header>
      <PageHeader :title="$t('settings.title')" />
    </header>

    <SelectMenu
      v-model="selectedTheme"
      id-name="theme-select"
      :label="$t('settings.theme')"
      @change="handleThemeChange"
    >
      <option v-for="option in themeOptions" :key="option.value" :value="option.value">
        {{ option.title }}
      </option>
    </SelectMenu>

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
      <NumberInput
        v-model.number="settings.maxPhe"
        id-name="max-phe"
        :label="$t('settings.max-phe')"
      />

      <NumberInput
        v-model.number="settings.maxKcal"
        id-name="max-kcal"
        :label="$t('settings.max-kcal')"
      />

      <SelectMenu
        v-model="settings.labUnit"
        id-name="unit"
        :label="$t('blood-values.unit')"
        class="mb-6"
      >
        <option v-for="option in unitOptions" :key="option.value" :value="option.value">
          {{ option.title }}
        </option>
      </SelectMenu>

      <PrimaryButton :text="$t('common.save')" @click="save" />

      <PageHeader title="PKU Tools Unlimited" class="mt-6" />
      <TiersCard />

      <PageHeader :title="$t('settings.license-heading')" class="mt-6" />
      <TextInput
        v-model="settings.license"
        id-name="license"
        :label="$t('settings.license-key')"
        class="mb-6"
      />
      <PrimaryButton :text="$t('settings.check-license')" @click="saveLicense" />

      <PageHeader :title="$t('settings.change-password')" class="mt-6" />
      <p class="mb-6">{{ $t('settings.change-password-info') }}</p>

      <PageHeader :title="$t('settings.reset-heading')" class="mt-6" />
      <SecondaryButton :text="$t('settings.reset-diary')" @click="resetDiary" />
      <SecondaryButton :text="$t('settings.reset-blood-values')" @click="resetLabValues" />
      <SecondaryButton :text="$t('settings.reset-own-food')" @click="resetOwnFood" />

      <PageHeader :title="$t('settings.delete-account')" class="mt-6" />
      <p class="mb-6">{{ $t('settings.delete-account-info') }}</p>
      <SecondaryButton :text="$t('settings.delete-account')" @click="deleteAccount" />
    </div>
  </div>
</template>
