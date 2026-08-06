# PKU Tools

PKU Tools is an All-in-One Nutrition App for PKU — a Progressive Web App (PWA) designed to help people with Phenylketonuria manage their low-phenylalanine diet. It combines a scale, nutritional table, calculator, pencil and paper into a single, easy-to-use application.

## Features

### Core Functionality

- **🔍 Food Search**: USDA and BLS food databases with fuzzy search (multilingual support)
- **📷 Barcode Scanner**: Scan product barcodes to lookup nutritional information
- **✨ AI Calculator**: Two modes — estimate weight and nutritional values from a description or photo, or read the printed values off a nutrition label
- **📱 Phe Calculator**: Calculate Phe or convert protein to Phe (with conversion factors for fruit, vegetables, meat, and other foods)
- **📅 Diary**: Daily food log with date navigation, progress bars, and smart suggestions based on eating history
- **📖 Diet Report**: Charts and sortable tables of dietary patterns over time, plus an averages card for a period you pick (CSV export)
- **📈 Blood Values**: Track and visualize Phe and tyrosine lab results with interactive charts (export as CSV, SVG, or PNG)
- **🍎 Own & Community Foods**: Save custom food entries (included in search) and share with the PKU community (voting and quality control)

### User Experience

- **🌍 Multi-language Support**: English, German, Spanish, and French with localized routes
- **📱 PWA Support**: Installable as native app (also available as TWA on Google Play Store)
- **🔄 Real-time Sync**: Data syncs across devices via Firebase Realtime Database
- **🌓 Dark Mode**: Automatic based on system preferences with manual override

## Tech Stack

**Frontend**: [Nuxt 4](https://nuxt.com/) with Vue 3, [Tailwind CSS](https://tailwindcss.com/) (via Vite plugin), [Headless UI](https://headlessui.com/), [TanStack Vue Table](https://tanstack.com/table), [ApexCharts](https://apexcharts.com/), [Lucide Icons](https://lucide.dev/) (via [nuxt-lucide-icons](https://nuxt.com/modules/lucide-icons))

**Backend**: Firebase (Realtime Database, Authentication), Nuxt server routes with Firebase Admin SDK

**State & Data**: [Pinia](https://pinia.vuejs.org/), [Fuse.js](https://fusejs.io/) for fuzzy search, [Zod](https://zod.dev/) for server-side validation

**i18n & SEO**: [@nuxtjs/i18n](https://i18n.nuxtjs.org/), [@nuxtjs/seo](https://nuxt-seo.vercel.app/), [Takumi](https://www.npmjs.com/package/@takumi-rs/core) for OG image rendering

**Tools**: ESLint, Prettier, TypeScript (for code quality and type checking), [Vitest](https://vitest.dev/) (for tests)

## Project History

PKU Tools has undergone significant refactoring over its versions:

- **Version 1**: Built with Vue 2, Options API, Vuetify, and Vuex
- **Version 2**: Refactored to Vue 3, Composition API, Tailwind CSS, and Pinia
- **Version 3** (current): Refactored to Nuxt 4 to improve performance, SEO, and developer experience

## Project Structure

```
pkutools-3/
├── app/
│   ├── components/     # Vue components
│   ├── composables/    # useApi, useLicense, etc.
│   ├── lib/            # Utility functions (e.g., table-utils)
│   ├── pages/          # File-based routing
│   ├── plugins/        # Firebase, ApexCharts
│   └── utils/          # Shared calculation and formatting helpers
├── i18n/locales/       # Translation files (en, de, es, fr)
├── public/data/        # Food database (JSON/CSV)
├── server/api/         # Server routes (diary, lab-values, own-food, etc.)
├── server/utils/       # Auth, validation, error handling
├── shared/utils/       # Code shared by app and server
├── stores/             # Pinia stores
├── tests/              # Vitest suites
├── scripts/            # BLS conversion and translation data
└── nuxt.config.ts
```

## Setup

### Prerequisites

- Node.js 20+ (required by Nuxt 4 / Vite 8)
- pnpm 11+
- Infisical CLI

### Installation

1. Clone the repository

2. Install Firebase CLI globally:

```bash
pnpm add -g firebase-tools
```

3. Install dependencies:

```bash
pnpm install
```

4. Log in to Infisical (required for `pnpm dev`, which runs `infisical run -- nuxt dev`):

```bash
infisical login
```

The workspace is configured in `.infisical.json`. Environment variables are injected at runtime — no local `.env` file is needed for development.

**Note**: For local development with Firebase emulators, real Firebase credentials are not required. The app works with emulators even if Infisical values are empty or placeholders. Real credentials are only required for production deployment or when connecting to a real Firebase project.

## Development

### Firebase Emulators

Start emulators with data persistence (no Firebase config needed for local dev):

```bash
pnpm emulators:data
```

**Important**: Always use `Ctrl+C` to stop emulators and preserve data. Emulator UI at `http://localhost:4000`.

**Troubleshooting**: If ports are stuck, force-kill: `lsof -ti:9099,9000,4000 | xargs kill -9` (ports: 9099=Auth, 9000=Database, 4000=UI)

### Start Development Server

```bash
pnpm dev
```

App available at `http://localhost:3000` (automatically connects to Firebase emulators).

### Available Scripts

- `pnpm dev` - Development server
- `pnpm build` - Production build
- `pnpm test` - Run the test suite (Vitest)
- `pnpm emulators` - Firebase emulators (no data persistence)
- `pnpm emulators:data` - Firebase emulators with data persistence
- `pnpm lint` / `pnpm lint:fix` - Linting
- `pnpm format:check` / `pnpm format` - Check/format code

### Tests

```bash
pnpm test
```

Vitest, no emulator or network needed. `tests/helpers/server-harness.ts` stands in for the Firebase Admin Realtime Database, so server routes can be driven end to end.

## Quality Assurance

- ESLint + Prettier + TypeScript for code quality, Vitest for tests
- Test on multiple devices/browsers (including PWA installation)
- Add translations for new strings in all locale files (en, de, es, fr)
- Analytics: PostHog (respects cookie consent), Umami (privacy analytics)
- Dependency management: Dependabot notifications, manual updates via `pnpm outdated`, `pnpm update`, `pnpm audit`

## Production

### Build

```bash
pnpm build
```

### Production Deployment

**Firebase Setup:**

- Realtime Database enabled
- Authentication (Google + Email/Password)
- Database rules configured (`database.rules.json`)

**Firebase Admin SDK** (for server-side operations):

- Get service account JSON from Firebase Console > Project Settings > Service Accounts
- Set environment variables:
  - `FIREBASE_ADMIN_PROJECT_ID` (from `project_id`)
  - `FIREBASE_ADMIN_CLIENT_EMAIL` (from `client_email`)
  - `FIREBASE_ADMIN_PRIVATE_KEY` (from `private_key`, include full key with headers)

**Note**: Admin SDK credentials not needed for local emulator development.

**Client-Side Firebase** (for production): Set environment variables as shown in `.env.example`.

**Note**: Client-side Firebase config not needed for local emulator development.

**License Keys** (for server-side validation):

- `PKU_TOOLS_LICENSE_KEY` - Premium license validation
- `PKU_TOOLS_LICENSE_KEY_2` - Premium license validation (also enables premium AI features)

Both keys are server-side only, never exposed to client.

**Deploy to Vercel:**

1. Connect repository
2. Add environment variables (see `.env.example` for all required variables)
3. Deploy (automatic on push to main)

## Architecture

**State Management**: Pinia store manages authentication, Gemini Developer API, and read-only state (diary entries, lab values, custom foods, settings) via Realtime Database.

**Data Flow**:

- Reads: Firebase Realtime Database listeners for instant sync across devices
- Writes: Nuxt server routes with Firebase Admin SDK for security and validation (Zod schemas)

**Server API**: All write operations require Firebase ID token authentication, validate with Zod schemas, and handle license validation server-side.

**Food Values**: Phe and calories throughout, plus protein, fat, carbs, sugars, fiber and salt where a source reports them. Each food records its source, which decides whether it can be shared. Rules in [app/utils/nutrition.ts](app/utils/nutrition.ts).

**Food Database**: Search merges the static JSON files in `/public/data/` with the user's own and community foods from Firebase. The BLS ships one file per locale, so nobody downloads names they cannot read.

**Database Creation**: The BLS files are generated, not hand-edited — `scripts/bls-convert.py` builds them from an xlsx placed in `data-src/` (not committed) and documents its translation and drop rules.

## Additional Information

- **i18n**: 4 languages (en, de, es, fr) with localized routes, content, dates, and charts
- **PWA**: Installable on mobile/desktop, TWA on Google Play, safe area support, mobile-first design
- **Privacy**: Health data consent (GDPR), cookie consent for analytics, consent history tracking
- **License**: Freemium model (limited free tier, premium with license key). Server-side validation only.

## Contributing

Contributions are welcome! If you want to contribute to the project:

1. Fork the repository on GitHub
2. Set up your local environment following the [Setup](#setup) instructions
3. Review the [Development](#development) section for running the app locally
4. Review the [Quality Assurance](#quality-assurance) section
5. Create a feature branch and make your changes
6. Commit and push to your fork
7. Open a Pull Request from your fork to the main repository

**Important**: When you open a pull request, you will be required to sign a Contributor License Agreement (CLA) through CLA Assistant. This is a one-time process that ensures your contributions can be used in the project.

## License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**. See the [LICENSE.txt](LICENSE.txt) file for the full license text.

## Support

- **Website**: [pkutools.com](https://pkutools.com)
- **Facebook**: [@pkutools](https://www.facebook.com/pkutools)
- **YouTube**: [@pkutools](https://www.youtube.com/@pkutools)

---

Made with ❤️ for the PKU community
