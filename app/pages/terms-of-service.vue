<script setup>
const { t } = useI18n()

const part1 = ref('mail')
const part2 = ref('pkutools')
const part3 = ref('com')

definePageMeta({
  i18n: {
    paths: {
      en: '/terms-of-service',
      de: '/nutzungsbedingungen',
      es: '/condiciones-servicio',
      fr: '/conditions-utilisation'
    }
  }
})

useSeoMeta({
  title: () => t('terms.title')
})

defineOgImage('Default', {
  title: () => t('terms.title') + ' - PKU Tools'
})
</script>

<template>
  <div class="prose dark:prose-invert">
    <h1>Terms of Service</h1>
    <p>Last updated: July 29, 2026</p>

    <h2>About PKU Tools</h2>
    <p>
      PKU Tools is an independent hobby project, built and run by André Reus for the PKU community.
      It is not run by a clinic or a healthcare provider. These terms apply when you use it.
    </p>
    <p>
      Most of the app is free. An optional paid membership helps cover running costs and raises some
      limits. Payments go through Ko-fi under their own terms. The app itself does not process
      payments.
    </p>

    <h2>Who can use PKU Tools</h2>
    <p>
      You need to be at least 18 to have an account. If you are a parent or legal guardian managing
      a child's PKU diet, use your own account rather than setting one up for the child. Only do
      this if you are legally allowed to provide the child's health information.
    </p>

    <h2>This is not medical advice</h2>
    <p>
      PKU Tools helps you calculate and record phenylalanine, calories and other nutrients. It is
      not intended to diagnose, prevent, monitor or treat PKU, and not intended for treatment
      decisions. It cannot tell you what your tolerance should be, whether a value is safe for you,
      or what to do about a blood result.
    </p>
    <p>
      Use it as a personal record and a calculation aid. It does not replace your metabolic clinic
      or dietitian. Do not change your diet, your medical food, your supplements or your medication
      based on what this app shows. If your values are out of range, or something feels wrong,
      contact your treatment team.
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
              that food type. The multiplication is exact, not a guess.
            </td>
            <td>
              The label data comes from a volunteer-maintained database and can be wrong. The factor
              is typical for the food type rather than measured for that product, so the result is
              still approximate.
            </td>
          </tr>
          <tr>
            <td><strong>AI Calculator</strong></td>
            <td>An AI model estimates the values from your description or photo.</td>
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
      For nutrients printed on a label, the label is the better source for that exact product. Bear
      in mind that label figures are rounded, and that labels usually do not state phenylalanine at
      all. If a difference matters for your treatment, ask your metabolic team.
    </p>
    <p>
      Values are rounded for display. Your daily targets are used exactly as entered in Settings, so
      if one of them is wrong, the percentages and remaining amounts calculated from it are wrong
      too.
    </p>

    <h2>Your account</h2>
    <p>
      Keep your account secure and use the app lawfully. Check anything that matters for your
      health, and make sure the targets you enter are correct.
    </p>

    <h2>Sharing foods with the community</h2>
    <p>
      Only share food information you are allowed to share and reasonably believe is correct. Do not
      put personal information in it. By sharing a food, you grant the operator a non-exclusive,
      royalty-free licence to store, display and adapt that entry for as long as it is needed to run
      the community database, including after your account is deleted.
    </p>
    <p>
      Shared entries can stay available after you delete your account, because other people may be
      relying on them. Not every entry can be checked, so please report anything that is wrong or
      should not be there.
    </p>

    <h2>Availability</h2>
    <p>
      This is a small service maintained by one person. It needs an internet connection and does not
      work offline. It may be unavailable, changed or discontinued, and no particular feature or
      level of availability is promised.
    </p>

    <h2>Liability</h2>
    <p>
      PKU Tools is provided as it is, and you use it at your own risk. Liability is excluded as far
      as the law allows.
    </p>
    <p>
      The law does not allow it to be excluded everywhere, and this section does not try to.
      Liability stays in place for intent and gross negligence, for injury to life, body or health,
      under the Product Liability Act, and where a guarantee was given.
    </p>
    <p>
      For ordinary negligence, liability stays in place only where the failure concerns something
      the service fundamentally has to get right, and that you could reasonably rely on it doing.
      Even then it covers only the kind of damage that is foreseeable and typical for a service like
      this. Mandatory consumer and digital-service rights are unaffected.
    </p>
    <p>
      The app uses data from third parties and shows content entered by other users. None of it is
      checked in full before it appears, and the operator does not control external websites linked
      from the app.
    </p>

    <h2>Governing law</h2>
    <p>
      German law applies. If you are a consumer in the EU, the mandatory consumer protection rules
      of the country you live in apply as well.
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
