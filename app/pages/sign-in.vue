<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useStore } from '../../stores/index'
import { TabGroup, TabList, Tab, TabPanels, TabPanel } from '@headlessui/vue'
import { BadgeCheck } from 'lucide-vue-next'

import EmailInput from '../components/EmailInput.vue'
import PasswordInput from '../components/PasswordInput.vue'
import TextInput from '../components/TextInput.vue'
import PrimaryButton from '../components/PrimaryButton.vue'

const store = useStore()
const { t } = useI18n()
const localePath = useLocalePath()

// Reactive state
const name = ref(null)
const email = ref(null)
const password = ref(null)

// Computed properties
const userIsAuthenticated = computed(() => store.user !== null)

// Methods
const signInGoogle = async () => {
  try {
    await store.signInGoogle()
    navigateTo(localePath('/'))
  } catch (error) {
    alert(t('app.auth-error'))
    console.error(error)
  }
}

const registerEmailPassword = async () => {
  try {
    await store.registerWithEmail(email.value, password.value, name.value)
    navigateTo(localePath('/'))
  } catch (error) {
    alert(t('sign-in.error'))
    console.error(error)
  }
}

const signInEmailPassword = async () => {
  try {
    await store.signInWithEmail(email.value, password.value)
    navigateTo(localePath('/'))
  } catch (error) {
    alert(t('sign-in.error'))
    console.error(error)
  }
}

const resetPassword = async () => {
  try {
    await store.resetPassword(email.value)
    alert(t('sign-in.password-sent'))
  } catch (error) {
    alert(t('sign-in.error'))
    console.error(error)
  }
}
</script>

<template>
  <div class="max-w-2xl">
    <div v-if="userIsAuthenticated">
      <h2 class="text-lg text-gray-900 dark:text-gray-300 mb-6">
        <BadgeCheck class="h-6 w-6 text-sky-500 inline-block ml-2 mr-1" aria-hidden="true" />
        {{ $t('sign-in.signedin') }}
      </h2>
    </div>

    <div v-if="!userIsAuthenticated">
      <a
        @click.prevent="signInGoogle"
        class="flex w-full items-center justify-center gap-3 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus-visible:ring-transparent cursor-pointer my-4"
      >
        <svg class="h-5 w-5" aria-hidden="true" viewBox="0 0 24 24">
          <path
            d="M12.0003 4.75C13.7703 4.75 15.3553 5.36002 16.6053 6.54998L20.0303 3.125C17.9502 1.19 15.2353 0 12.0003 0C7.31028 0 3.25527 2.69 1.28027 6.60998L5.27028 9.70498C6.21525 6.86002 8.87028 4.75 12.0003 4.75Z"
            fill="#EA4335"
          />
          <path
            d="M23.49 12.275C23.49 11.49 23.415 10.73 23.3 10H12V14.51H18.47C18.18 15.99 17.34 17.25 16.08 18.1L19.945 21.1C22.2 19.01 23.49 15.92 23.49 12.275Z"
            fill="#4285F4"
          />
          <path
            d="M5.26498 14.2949C5.02498 13.5699 4.88501 12.7999 4.88501 11.9999C4.88501 11.1999 5.01998 10.4299 5.26498 9.7049L1.275 6.60986C0.46 8.22986 0 10.0599 0 11.9999C0 13.9399 0.46 15.7699 1.28 17.3899L5.26498 14.2949Z"
            fill="#FBBC05"
          />
          <path
            d="M12.0004 24.0001C15.2404 24.0001 17.9654 22.935 19.9454 21.095L16.0804 18.095C15.0054 18.82 13.6204 19.245 12.0004 19.245C8.8704 19.245 6.21537 17.135 5.2654 14.29L1.27539 17.385C3.25539 21.31 7.3104 24.0001 12.0004 24.0001Z"
            fill="#34A853"
          />
        </svg>
        <span class="text-sm/6 font-semibold">{{ $t('app.signin-google') }}</span>
      </a>

      <div class="relative my-8">
        <div class="absolute inset-0 flex items-center" aria-hidden="true">
          <div class="w-full border-t-2 border-gray-200 dark:border-gray-600" />
        </div>
        <div class="relative flex justify-center text-sm/6 font-medium">
          <span class="bg-gray-50 dark:bg-gray-950 px-6 text-gray-900 dark:text-gray-300">{{
            $t('sign-in.or')
          }}</span>
        </div>
      </div>

      <h2 class="text-lg text-gray-900 dark:text-gray-300 mb-6">
        {{ $t('sign-in.title') }}
      </h2>

      <TabGroup>
        <TabList class="mb-6">
          <Tab v-slot="{ selected }">
            <button
              :class="[
                'rounded-md px-3 py-2 text-sm font-medium dark:text-gray-300 cursor-pointer',
                selected
                  ? 'bg-black/5 dark:bg-white/15 text-gray-700'
                  : 'text-gray-500 hover:text-gray-700'
              ]"
            >
              {{ $t('sign-in.signin') }}
            </button>
          </Tab>
          <Tab v-slot="{ selected }">
            <button
              :class="[
                'rounded-md px-3 py-2 text-sm font-medium dark:text-gray-300 cursor-pointer',
                selected
                  ? 'bg-black/5 dark:bg-white/15 text-gray-700'
                  : 'text-gray-500 hover:text-gray-700'
              ]"
            >
              {{ $t('sign-in.register') }}
            </button>
          </Tab>
          <Tab v-slot="{ selected }">
            <button
              :class="[
                'rounded-md px-3 py-2 text-sm font-medium dark:text-gray-300 cursor-pointer',
                selected
                  ? 'bg-black/5 dark:bg-white/15 text-gray-700'
                  : 'text-gray-500 hover:text-gray-700'
              ]"
            >
              {{ $t('sign-in.forgot-password') }}
            </button>
          </Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <EmailInput id-name="email" :label="$t('sign-in.email')" v-model="email" />
            <PasswordInput id-name="password" :label="$t('sign-in.password')" v-model="password" />

            <PrimaryButton :text="$t('sign-in.signin')" @click="signInEmailPassword" class="mt-4" />
          </TabPanel>
          <TabPanel>
            <p class="mt-2 mb-6">{{ $t('sign-in.register-note') }}</p>

            <TextInput id-name="name" :label="$t('sign-in.name')" v-model="name" />
            <EmailInput id-name="register-email" :label="$t('sign-in.email')" v-model="email" />
            <PasswordInput
              id-name="register-password"
              :label="$t('sign-in.password')"
              v-model="password"
            />

            <PrimaryButton
              :text="$t('sign-in.register')"
              @click="registerEmailPassword"
              class="mt-4"
            />
          </TabPanel>
          <TabPanel>
            <p class="mt-2 mb-6">{{ $t('sign-in.reset-note') }}</p>

            <EmailInput id-name="reset-email" :label="$t('sign-in.email')" v-model="email" />

            <PrimaryButton
              :text="$t('sign-in.reset-password')"
              @click="resetPassword"
              class="mt-4"
            />
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </div>
  </div>
</template>
