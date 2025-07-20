<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useStore } from '../../stores/index'
import { getDatabase, ref as dbRef, remove, update } from 'firebase/database'
import { getAuth } from 'firebase/auth'
import { Check } from 'lucide-vue-next'

import PageHeader from '../components/PageHeader.vue'
import SelectMenu from '../components/SelectMenu.vue'
import NumberInput from '../components/NumberInput.vue'
import TextInput from '../components/TextInput.vue'
import PrimaryButton from '../components/PrimaryButton.vue'
import SecondaryButton from '../components/SecondaryButton.vue'
import TiersCard from '../components/TiersCard.vue'

const router = useRouter()
const store = useStore()
const { t } = useI18n()

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
    if (settings.value.license === import.meta.env.VITE_PKU_TOOLS_LICENSE_KEY) {
      alert(t('settings.license-active') + ' 🎉')
    } else {
      alert(t('settings.license-inactive'))
    }
  })
}

const resetDiary = () => {
  let r = confirm(t('settings.reset-diary') + '?')
  if (r === true) {
    const db = getDatabase()
    remove(dbRef(db, `${user.value.id}/pheDiary`))
    router.push('phe-diary')
  }
}

const resetLabValues = () => {
  let r = confirm(t('settings.reset-lab-values') + '?')
  if (r === true) {
    const db = getDatabase()
    remove(dbRef(db, `${user.value.id}/labValues`))
    router.push('lab-values')
  }
}

const resetOwnFood = () => {
  let r = confirm(t('settings.reset-own-food') + '?')
  if (r === true) {
    const db = getDatabase()
    remove(dbRef(db, `${user.value.id}/ownFood`))
    router.push('own-food')
  }
}

const deleteAccount = () => {
  let r = confirm(t('settings.delete-account') + '?')
  if (r === true) {
    const db = getDatabase()
    const auth = getAuth()
    remove(dbRef(db, store.user.id))
    auth.currentUser
      .delete()
      .then(() => {
        store.signOut()
        router.push('/')
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
      id-name="theme-select"
      :label="$t('settings.theme')"
      v-model="selectedTheme"
      @change="handleThemeChange"
    >
      <option v-for="option in themeOptions" :key="option.value" :value="option.value">
        {{ option.title }}
      </option>
    </SelectMenu>

    <div v-if="!userIsAuthenticated">
      <SecondaryButton :text="$t('app.signin-google')" @click="signInGoogle" />
      <br />
      <RouterLink
        type="button"
        to="/email-auth"
        class="rounded-sm bg-black/5 dark:bg-white/15 px-2 py-1 text-sm font-semibold text-gray-900 dark:text-gray-300 shadow-xs hover:bg-black/10 dark:hover:bg-white/10 mr-3 mb-6"
      >
        {{ $t('email-auth.title') }}
      </RouterLink>
    </div>

    <div v-if="userIsAuthenticated">
      <NumberInput
        id-name="max-phe"
        :label="$t('settings.max-phe')"
        v-model.number="settings.maxPhe"
      />

      <NumberInput
        id-name="max-kcal"
        :label="$t('settings.max-kcal')"
        v-model.number="settings.maxKcal"
      />

      <SelectMenu
        id-name="unit"
        :label="$t('lab-values.unit')"
        v-model="settings.labUnit"
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
        id-name="license"
        :label="$t('settings.license-key')"
        v-model="settings.license"
        class="mb-6"
      />
      <PrimaryButton :text="$t('settings.check-license')" @click="saveLicense" />

      <PageHeader :title="$t('settings.change-password')" class="mt-6" />
      <p class="mb-6">{{ $t('settings.change-password-info') }}</p>

      <PageHeader :title="$t('settings.reset-heading')" class="mt-6" />
      <SecondaryButton :text="$t('settings.reset-diary')" @click="resetDiary" />
      <SecondaryButton :text="$t('settings.reset-lab-values')" @click="resetLabValues" />
      <SecondaryButton :text="$t('settings.reset-own-food')" @click="resetOwnFood" />

      <PageHeader :title="$t('settings.delete-account')" class="mt-6" />
      <p class="mb-6">{{ $t('settings.delete-account-info') }}</p>
      <SecondaryButton :text="$t('settings.delete-account')" @click="deleteAccount" />
    </div>
  </div>
</template>
