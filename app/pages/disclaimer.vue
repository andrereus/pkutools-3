<script setup>
const { t } = useI18n()

const part1 = ref('mail')
const part2 = ref('pkutools')
const part3 = ref('com')

definePageMeta({
  i18n: {
    paths: {
      en: '/disclaimer',
      de: '/disclaimer',
      es: '/descargo-responsabilidad',
      fr: '/avertissement'
    }
  }
})

useSeoMeta({
  title: () => t('disclaimer.title')
})

defineOgImage('Default', {
  title: () => t('disclaimer.title') + ' - PKU Tools'
})
</script>

<template>
  <div class="prose dark:prose-invert">
    <h1>Disclaimer</h1>
    <p>Last updated: July 28, 2026</p>

    <h2>This is not medical advice</h2>
    <p>
      PKU Tools helps you calculate and record phenylalanine, calories and other nutrients. It does
      not diagnose, does not prescribe, and is not a medical device. It cannot tell you what your
      tolerance should be, whether a value is safe for you, or what to do about a blood result.
    </p>
    <p>
      Those decisions belong to your metabolic clinic or dietitian. Do not change your diet, your
      supplements or your medication based on what this app shows. If your values are out of range,
      or something feels wrong, contact your treatment team.
    </p>

    <h2>Where the numbers come from</h2>
    <p>
      The app has several sources, and they differ in how reliable they are. Knowing which one you
      are looking at is the most useful thing on this page.
    </p>
    <div class="overflow-x-auto">
      <table>
        <thead>
          <tr>
            <th>Source</th>
            <th>How the value is produced</th>
            <th>What to watch for</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Food database</strong></td>
            <td>Looked up from a public nutrition database.</td>
            <td>Describes a food in general, so a particular brand or recipe can differ.</td>
          </tr>
          <tr>
            <td><strong>Barcode scan</strong></td>
            <td>
              The protein figure on the label is multiplied by a standard phenylalanine factor for
              that food type. It is a calculation, not a guess.
            </td>
            <td>
              The label data comes from a volunteer-maintained database and can be wrong. The factor
              is typical for the food type, not specific to that product.
            </td>
          </tr>
          <tr>
            <td><strong>AI Calculator</strong></td>
            <td>
              An AI model estimates the values from your description or photo. This is the only part
              of the app that estimates.
            </td>
            <td>Estimates can be confidently wrong. Check anything that matters.</td>
          </tr>
          <tr>
            <td><strong>Community foods</strong></td>
            <td>Entered by other users to share, and rated by the community.</td>
            <td>Nobody verifies the values before they appear.</td>
          </tr>
          <tr>
            <td><strong>Your own foods</strong></td>
            <td>Whatever you entered.</td>
            <td>As accurate as your input was.</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p>
      Where a product label and the app disagree, the label is the better source. It describes the
      food actually in front of you.
    </p>
    <p>
      Values are rounded for display. Your daily targets are used exactly as entered in Settings, so
      if one of them is wrong, the percentages and remaining amounts calculated from it are wrong
      too.
    </p>

    <h2>Availability</h2>
    <p>
      PKU Tools needs an internet connection and does not work offline. It may be unavailable, slow,
      or missing features at times, so do not rely on it being reachable at a particular moment.
    </p>

    <h2>Liability</h2>
    <p>
      PKU Tools is provided as it is, without warranty of any kind, and you use it at your own risk.
      The operator of PKU Tools does not guarantee that the information in it is accurate, complete
      or current.
    </p>
    <p>
      To the extent the law allows, the operator is not liable for damage arising from use of the
      app, from relying on the values it shows, or from it being unavailable. This does not limit
      liability for injury to life, body or health, or for damage caused intentionally or through
      gross negligence, and it does not limit rights you have as a consumer under German or EU law.
    </p>
    <p>
      The app links to other websites and uses data from third parties. The operator does not
      control their content or accuracy and is not responsible for either.
    </p>

    <h2>Questions</h2>
    <!-- prettier-ignore -->
    <p>Questions, or a value that looks wrong, can be sent by email to {{ part1 }}@<span class="hidden">null</span>{{ part2 }}.{{ part3 }}.</p>
  </div>
</template>

<style scoped>
.hidden {
  display: none;
}
</style>
