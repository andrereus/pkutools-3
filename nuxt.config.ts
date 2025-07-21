import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  app: {
    head: {
      title: 'PKU Tools',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1.0, viewport-fit=cover' },
        { name: 'description', content: 'Tools and apps for PKU.' },
        { name: 'theme-color', content: '#3498db' }
      ],
      link: [
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon-180x180.png', sizes: '180x180' }
      ],
      script: [
        {
          textContent: `
            function updateTheme() {
              const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
              const selectedTheme = localStorage.getItem('theme') || 'system'
              if (selectedTheme === 'dark' || (selectedTheme === 'system' && systemTheme === true)) {
                document.documentElement.classList.add('dark')
              } else {
                document.documentElement.classList.remove('dark')
              }
            }
            updateTheme()
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateTheme)
          `,
          type: 'text/javascript'
        },
        {
          src: 'https://cloud.umami.is/script.js',
          defer: true,
          'data-website-id': 'f46a04a8-9ab1-481e-8683-63227a3b9d17'
        },
        { src: '//cdn.headwayapp.co/widget.js', async: true }
      ],
      htmlAttrs: {
        lang: 'en',
        class: 'h-full'
      },
      bodyAttrs: {
        class: 'h-full bg-gray-50 dark:bg-gray-950'
      }
    }
  },
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  modules: ['@nuxt/eslint', '@pinia/nuxt', '@nuxtjs/i18n', 'nuxt-lucide-icons'],
  vite: {
    plugins: [tailwindcss()]
  },
  runtimeConfig: {
    public: {
      firebaseApiKey: process.env.FIREBASE_API_KEY,
      firebaseAuthDomain: process.env.FIREBASE_AUTH_DOMAIN,
      firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
      firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      firebaseMessagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      firebaseAppId: process.env.FIREBASE_APP_ID,
      firebaseDatabaseURL: process.env.FIREBASE_DATABASE_URL
    }
  },
  i18n: {
    defaultLocale: 'en',
    locales: [
      { code: 'en', name: 'English', file: 'en.json' },
      { code: 'de', name: 'German', file: 'de.json' },
      { code: 'es', name: 'Spanish', file: 'es.json' },
      { code: 'fr', name: 'French', file: 'fr.json' }
    ]
  }
})
