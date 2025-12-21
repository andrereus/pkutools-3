import tailwindcss from '@tailwindcss/vite'
import { defineOrganization } from 'nuxt-schema-org/schema'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  app: {
    head: {
      title: 'PKU Tools',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1.0, viewport-fit=cover' },
        {
          name: 'description',
          content:
            'Nutrition app for low-phenylalanine diets. This app is intended for people with PKU.'
        },
        { name: 'theme-color', content: '#3498db' },
        { name: 'google', content: 'notranslate' }
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
          textContent: `
            var consent = localStorage.getItem('cookie_consent')
            var persistence = consent === 'yes' ? 'localStorage+cookie' : 'memory'
            !(function (t, e) {
              var o, n, p, r
              e.__SV ||
                ((window.posthog = e),
                (e._i = []),
                (e.init = function (i, s, a) {
                  function g(t, e) {
                    var o = e.split('.')
                    ;(2 == o.length && ((t = t[o[0]]), (e = o[1])),
                      (t[e] = function () {
                        t.push([e].concat(Array.prototype.slice.call(arguments, 0)))
                      }))
                  }
                  ;(((p = t.createElement('script')).type = 'text/javascript'),
                    (p.crossOrigin = 'anonymous'),
                    (p.async = !0),
                    (p.src =
                      s.api_host.replace('.i.posthog.com', '-assets.i.posthog.com') + '/static/array.js'),
                    (r = t.getElementsByTagName('script')[0]).parentNode.insertBefore(p, r))
                  var u = e
                  for (
                    void 0 !== a ? (u = e[a] = []) : (a = 'posthog'),
                      u.people = u.people || [],
                      u.toString = function (t) {
                        var e = 'posthog'
                        return ('posthog' !== a && (e += '.' + a), t || (e += ' (stub)'), e)
                      },
                      u.people.toString = function () {
                        return u.toString(1) + '.people (stub)'
                      },
                      o =
                        'init Ie Ts Ms Ee Es Rs capture Ge calculateEventProperties Os register register_once register_for_session unregister unregister_for_session js getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSurveysLoaded onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey canRenderSurveyAsync identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty Ds Fs createPersonProfile Ls Ps opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing Cs debug I As getPageViewId captureTraceFeedback captureTraceMetric'.split(
                          ' '
                        ),
                      n = 0;
                    n < o.length;
                    n++
                  )
                    g(u, o[n])
                  e._i.push([i, s, a])
                }),
                (e.__SV = 1))
            })(document, window.posthog || [])
            posthog.init('phc_jkTYO4QwKkbZ7AxI5HnJ8Ma6sKr3WjT9TpDJCfTsbgd', {
              api_host: 'https://eu.i.posthog.com',
              defaults: '2025-05-24',
              persistence: persistence,
              person_profiles: 'identified_only'
            })
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
        translate: 'no',
        class: 'h-full notranslate'
      },
      bodyAttrs: {
        class: 'h-full bg-gray-50 dark:bg-gray-950'
      }
    },
    pageTransition: { name: 'page', mode: 'out-in' }
  },
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  modules: [
    '@nuxt/eslint',
    '@pinia/nuxt',
    '@nuxtjs/i18n',
    'nuxt-lucide-icons',
    'nuxt-headlessui',
    '@nuxtjs/seo'
  ],
  vite: {
    plugins: [tailwindcss()]
  },
  runtimeConfig: {
    // Server-side only (private)
    firebaseAdminProjectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    firebaseAdminClientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    firebaseAdminPrivateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY,
    pkutoolsLicenseKey: process.env.PKU_TOOLS_LICENSE_KEY,
    // Public (exposed to client)
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
    baseUrl: 'https://pkutools.com',
    locales: [
      { code: 'de', name: 'Deutsch', file: 'de.json', language: 'de' },
      { code: 'en', name: 'English', file: 'en.json', language: 'en' },
      { code: 'es', name: 'Español', file: 'es.json', language: 'es' },
      { code: 'fr', name: 'Français', file: 'fr.json', language: 'fr' }
    ],
    defaultLocale: 'en',
    customRoutes: 'meta'
  },
  site: {
    url: 'https://pkutools.com',
    name: 'PKU Tools',
    description:
      'Nutrition app for low-phenylalanine diets. This app is intended for people with PKU.'
  },
  schemaOrg: {
    identity: defineOrganization({
      name: 'PKU Tools',
      logo: '/logo-512.png'
    })
  }
})
