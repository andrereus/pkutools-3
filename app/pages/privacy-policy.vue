<script setup>
const { t } = useI18n()

const part1 = ref('mail')
const part2 = ref('pkutools')
const part3 = ref('com')

definePageMeta({
  i18n: {
    paths: {
      en: '/privacy-policy',
      de: '/datenschutz',
      es: '/politica-privacidad',
      fr: '/politique-confidentialite'
    }
  }
})

useSeoMeta({
  title: () => t('privacy-policy.title')
})

defineOgImage('Default', {
  title: () => t('privacy-policy.title') + ' - PKU Tools'
})
</script>

<template>
  <div class="prose dark:prose-invert">
    <h1>Privacy Policy</h1>
    <p>Last updated: July 28, 2026</p>

    <h2>Who is responsible</h2>
    <p>
      PKU Tools is operated by André Reus. Under the GDPR the operator is the controller for the
      data described here. This policy covers the website and the app, which work the same way and
      store your data in the same place.
    </p>
    <!-- prettier-ignore -->
    <p>The operator can be reached by email at {{ part1 }}@<span class="hidden">null</span>{{ part2 }}.{{ part3 }}.</p>

    <h2>What is stored, and why</h2>
    <div class="overflow-x-auto">
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Why</th>
            <th>Legal basis</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Email address and sign-in details, or your Google account identifier</td>
            <td>To create your account and let you sign back in</td>
            <td>Performance of a contract (Art. 6(1)(b))</td>
          </tr>
          <tr>
            <td>Your nutrition diary</td>
            <td>To show your daily intake and your progress over time</td>
            <td>Your explicit consent (Art. 9(2)(a))</td>
          </tr>
          <tr>
            <td>Your blood values</td>
            <td>To chart your values against your target range</td>
            <td>Your explicit consent (Art. 9(2)(a))</td>
          </tr>
          <tr>
            <td>Custom foods you create</td>
            <td>So you can reuse your own foods</td>
            <td>Your explicit consent (Art. 9(2)(a))</td>
          </tr>
          <tr>
            <td>Your targets, target ranges and app preferences</td>
            <td>To calculate your targets and remember how you want the app to behave</td>
            <td>Your explicit consent (Art. 9(2)(a))</td>
          </tr>
          <tr>
            <td>Whether you consented, and when</td>
            <td>To prove consent was given, as the GDPR requires</td>
            <td>Legal obligation (Art. 6(1)(c))</td>
          </tr>
          <tr>
            <td>Your usage of AI estimates, and your premium status</td>
            <td>To apply the usage limits that come with your plan</td>
            <td>Performance of a contract (Art. 6(1)(b))</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p>
      Your diary, blood values and targets say something about your health, so the GDPR treats them
      as a special category of data. That is why the app asks for explicit consent before storing
      any of it, and why most features stay switched off until you give it. You can withdraw that
      consent at any time in Settings. Withdrawing stops further storage but does not delete what is
      already stored, which you can do separately in Settings.
    </p>

    <h2>Services used</h2>
    <div class="overflow-x-auto">
      <table>
        <thead>
          <tr>
            <th>Service</th>
            <th>What it receives</th>
            <th>When</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>Firebase</strong> (Google)
              <br />
              <a
                href="https://policies.google.com/privacy"
                rel="external nofollow noopener"
                target="_blank"
                >Privacy policy</a
              >
            </td>
            <td>
              Your account details and everything you save. It provides sign-in and the database.
            </td>
            <td>Whenever you are signed in</td>
          </tr>
          <tr>
            <td>
              <strong>Google Gemini</strong>, via Firebase AI Logic
              <br />
              <a
                href="https://ai.google.dev/gemini-api/terms"
                rel="external nofollow noopener"
                target="_blank"
                >API terms</a
              >
            </td>
            <td>
              The description or photo you submit to the AI Calculator, and the food name when the
              app generates an icon for it.
            </td>
            <td>Only when you use the AI Calculator or save a food</td>
          </tr>
          <tr>
            <td>
              <strong>Open Food Facts</strong>
              <br />
              <a
                href="https://world.openfoodfacts.org/privacy"
                rel="external nofollow noopener"
                target="_blank"
                >Privacy policy</a
              >
            </td>
            <td>The barcode you scanned, and your IP address.</td>
            <td>Only when you scan a barcode</td>
          </tr>
          <tr>
            <td>
              <strong>PostHog</strong> (EU servers)
              <br />
              <a href="https://posthog.com/privacy" rel="external nofollow noopener" target="_blank"
                >Privacy policy</a
              >
            </td>
            <td>
              Which pages you open, your IP address, and session replays, which can include content
              shown on the page.
            </td>
            <td>Every visit</td>
          </tr>
          <tr>
            <td>
              <strong>Umami</strong>
              <br />
              <a href="https://umami.is/privacy" rel="external nofollow noopener" target="_blank"
                >Privacy policy</a
              >
            </td>
            <td>Page views, without cookies.</td>
            <td>Every visit</td>
          </tr>
          <tr>
            <td>
              <strong>Headway</strong>
              <br />
              <a
                href="https://headwayapp.co/privacy"
                rel="external nofollow noopener"
                target="_blank"
                >Privacy policy</a
              >
            </td>
            <td>Your IP address, to show the changelog widget.</td>
            <td>Every visit</td>
          </tr>
          <tr>
            <td>
              <strong>Google Play</strong>
              <br />
              <a
                href="https://policies.google.com/privacy"
                rel="external nofollow noopener"
                target="_blank"
                >Privacy policy</a
              >
            </td>
            <td>Whatever Google collects when you install or update the app.</td>
            <td>Only if you install from Google Play</td>
          </tr>
        </tbody>
      </table>
    </div>

    <h2>Where your data is stored</h2>
    <p>
      The database holding your diary, blood values and custom foods runs in the United States. The
      transfer is covered by the European Commission's standard contractual clauses and by Google's
      certification under the EU-US Data Privacy Framework. PostHog is the exception and runs on
      European servers.
    </p>

    <h2>Cookies and local storage</h2>
    <p>The app stores a few things in your browser, and none of them is used to track you:</p>
    <ul>
      <li><code>theme</code> — whether you chose light, dark or system appearance.</li>
      <li><code>cookie_consent</code> — whether you accepted or declined analytics cookies.</li>
      <li><code>barcode_camera</code> — which camera you last used for scanning.</li>
    </ul>
    <p>
      Signing in also stores a session token, so you stay signed in. That is required for the app to
      work.
    </p>
    <p>
      Analytics run without cookies until you accept them. Declining changes nothing about how the
      app works for you.
    </p>

    <h2>Sharing a food with the community</h2>
    <p>
      Custom foods are private. You can share one with the community by ticking the sharing option
      on that food. Only that food is shared: what you entered about it, and the language you shared
      it in.
    </p>
    <p>
      A shared food stays linked to your own copy of it by your user ID. That link is what lets you
      keep editing the food, or stop sharing it again later. Your ID is not shown to anyone, and
      your name and email are not attached to a shared food.
    </p>

    <h2>Emails</h2>
    <p>
      Emails about app updates are optional and separate from your health data consent. You can turn
      them on or off in Settings.
    </p>
    <p>Emails needed to run your account, such as a password reset, are sent regardless.</p>

    <h2>How long data is kept</h2>
    <p>
      Your data is kept for as long as your account exists. When you delete your account, your data
      and your sign-in record are removed from the live database straight away.
    </p>
    <p>
      The database is backed up automatically and those backups are kept for 30 days. So for up to
      30 days after you delete your account, your data still exists inside a backup, after which it
      is gone for good.
    </p>
    <p>
      Foods you shared with the community stay, because other people may be using them, but they are
      not linked to you in any way that is visible.
    </p>

    <h2>Your rights</h2>
    <p>Under the GDPR you can:</p>
    <ul>
      <li>ask what data is stored about you, and get a copy of it</li>
      <li>have inaccurate data corrected</li>
      <li>have your data deleted</li>
      <li>ask for the use of your data to be restricted</li>
      <li>receive your data in a portable, machine-readable format</li>
      <li>withdraw your consent at any time, without giving a reason</li>
    </ul>
    <p>
      Deletion and consent withdrawal are built into Settings, so you do not have to ask. For
      anything else, contact the operator by email.
    </p>
    <p>
      You also have the right to lodge a complaint with a data protection authority. The competent
      authority for PKU Tools is the Landesbeauftragte für den Datenschutz und die
      Informationsfreiheit Baden-Württemberg, and you can equally go to the authority where you
      live.
    </p>

    <h2>Security</h2>
    <p>Data is transmitted over encrypted connections.</p>

    <h2>Changes to this policy</h2>
    <p>If this policy changes, the date at the top changes with it.</p>

    <h2>Questions</h2>
    <!-- prettier-ignore -->
    <p>Questions can be sent by email to {{ part1 }}@<span class="hidden">null</span>{{ part2 }}.{{ part3 }}.</p>
  </div>
</template>

<style scoped>
.hidden {
  display: none;
}
</style>
