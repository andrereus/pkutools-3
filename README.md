# PKU Tools

PKU Tools is a comprehensive Progressive Web App (PWA) designed to help people with Phenylketonuria (PKU) manage their low-phenylalanine diet. It combines a calculator, food diary, nutritional database, and tracking tools into a single, easy-to-use application.

## Features

### Core Functionality

- **🔍 Food Search**: Search through a comprehensive USDA-based food database with multilingual support. Uses fuzzy search (Fuse.js) to find foods quickly, even with typos or partial matches.

- **📷 Barcode Scanner**: Scan product barcodes to quickly look up nutritional information (requires camera access).

- **📱 Phe Calculator**: Calculate phenylalanine content from:
  - Direct Phe values (mg per 100g)
  - Protein content with automatic conversion factors:
    - Fruit: 27 mg Phe per 1g protein
    - Vegetables: 35 mg Phe per 1g protein
    - Meat: 46 mg Phe per 1g protein
    - Other foods: 50 mg Phe per 1g protein

- **✨ Estimation feature (Beta)**: Estimate Phe and calorie values for foods using AI when no nutritional data is available.

- **📅 Diary**: Daily food log with:
  - Date navigation (view past and future days)
  - Progress bars showing Phe and calorie consumption vs. daily limits
  - Quick-add suggestions based on recently used foods (recency-weighted algorithm)
  - Edit and delete entries

- **📖 Diet Report**: Generate comprehensive reports on dietary patterns and compliance.

- **📈 Blood Values**: Track and visualize lab results:
  - Record Phe and tyrosine blood values
  - Interactive charts with ApexCharts
  - Export data as CSV, SVG, or PNG
  - Multilingual chart labels

- **🍎 Own Foods**: Create and manage custom food entries with:
  - Custom Phe and calorie values
  - Icon selection from 307+ food icons
  - Automatically included in food search results

- **🤖 Assistant**: Overview and insights about the diet.

### User Experience

- **🌍 Multi-language Support**: Available in English, German, Spanish, and French with localized routes and content.

- **📱 PWA Support**: Install as a native app on mobile and desktop devices via web manifest. Also available as a TWA (Trusted Web Activity) on Google Play Store.

- **🔄 Real-time Sync**: All data syncs in real-time across devices using Firebase Realtime Database.

- **🌓 Dark Mode**: Automatic dark mode based on system preferences with manual override option.

- **✨ Smart Suggestions**: One-click food suggestions based on your eating history, prioritizing recently consumed items.

## Tech Stack

### Frontend

- **Framework**: [Nuxt 4](https://nuxt.com/) with Vue 3
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) with `@tailwindcss/vite`
- **Icons**: [Lucide Icons](https://lucide.dev/) via `nuxt-lucide-icons`
- **UI Components**: [Headless UI](https://headlessui.com/) via `nuxt-headlessui`
- **Charts**: [ApexCharts](https://apexcharts.com/) with `vue3-apexcharts`
- **Date Handling**: [date-fns](https://date-fns.org/)

**Note**: `@nuxtjs/tailwindcss` doesn't fully support Nuxt 4 yet, so Tailwind is configured via Vite plugin instead.

### State Management & Data

- **State Management**: [Pinia](https://pinia.vuejs.org/)
- **Database**: [Firebase Realtime Database](https://firebase.google.com/docs/database)
- **Authentication**: [Firebase Authentication](https://firebase.google.com/docs/auth) (Google OAuth + Email/Password)
- **Search**: [Fuse.js](https://fusejs.io/) for fuzzy search
- **Server API**: Nuxt server routes with Firebase Admin SDK for secure data operations

### Internationalization & SEO

- **i18n**: [@nuxtjs/i18n](https://i18n.nuxtjs.org/)
- **SEO**: [@nuxtjs/seo](https://nuxt-seo.vercel.app/) with Schema.org markup

### Development Tools

- **Linting**: ESLint with `@nuxt/eslint`
- **Formatting**: Prettier
- **TypeScript**: Type checking support
- **Package Manager**: npm (also supports pnpm, yarn, bun)

### Analytics & Monitoring

- **Product Analytics**: PostHog (respects cookie consent)
- **Privacy Analytics**: Umami
- **Changelog**: Headway widget

### Deployment

- **Hosting**: Vercel (recommended)
- **Build**: Nuxt static generation or SSR

## Project History

PKU Tools has undergone significant refactoring over its versions:

- **Version 1**: Built with Vue 2, Options API, Vuetify, and Vuex
- **Version 2**: Refactored to Vue 3, Composition API, Tailwind CSS, and Pinia
- **Version 3** (current): Refactored to Nuxt 4 to improve performance, SEO, and developer experience

## Project Structure

```
pkutools-3/
├── app/
│   ├── assets/         # Static assets
│   │   ├── css/        # Global styles
│   │   ├── data/       # Food icons mapping
│   │   └── images/     # Images and icons
│   ├── components/     # Reusable Vue components
│   ├── composables/    # Vue composables (useApi, useLicense, etc.)
│   ├── layouts/        # Layout components
│   ├── pages/          # Route pages (file-based routing)
│   └── plugins/        # Nuxt plugins (Firebase, ApexCharts)
├── i18n/
│   └── locales/        # Translation files (en, de, es, fr)
├── public/
│   ├── data/           # Static food database (JSON/CSV)
│   ├── images/         # Public images and food icons
│   └── videos/         # Demo videos
├── server/
│   ├── api/            # Server API routes (Nuxt server routes)
│   │   ├── diary/      # Diary CRUD operations
│   │   ├── gemini/     # AI estimation API
│   │   ├── lab-values/ # Lab values CRUD operations
│   │   ├── license/    # License validation
│   │   ├── own-food/   # Custom foods CRUD operations
│   │   └── settings/   # Settings and account management
│   ├── config/         # Server configuration (Firebase Admin credentials)
│   ├── types/          # TypeScript types and Zod schemas
│   └── utils/          # Server utilities (Firebase Admin helpers)
├── stores/             # Pinia stores
├── nuxt.config.ts      # Nuxt configuration
├── package.json        # Dependencies and scripts
└── tsconfig.json       # TypeScript configuration
```

## Setup

### Prerequisites

- Node.js 18+ (or compatible runtime)
- npm, pnpm, yarn, or bun

### Installation

1. Clone the repository

2. Install Firebase CLI globally:

```bash
npm install -g firebase-tools
```

3. Install dependencies:

```bash
npm install
```

**Note**: For local development with emulators, Firebase environment variables are not required. The app should work with emulators even if the `.env` file is missing or contains placeholder values. The `.env` file is only required for production deployment or when connecting to a real Firebase project.

## Development

### Firebase Emulators

For local development, you can use Firebase emulators to test without affecting your production database. No Firebase project configuration or environment variables are needed for local development with emulators.

Start Firebase emulator with data persistence:

```bash
npm run emulators:data
```

**Important**: Always use Ctrl+C before closing the terminal to ensure data is exported. If you close the terminal without using Ctrl+C, your emulator data will be lost.

The emulator UI will be available at `http://localhost:4000`.

### Start Development Server

Start the development server (in a separate terminal):

```bash
npm run dev
```

The app will automatically connect to the Firebase emulators when running in development mode. You'll see "Connected to Firebase emulators" in the browser console.

The app will be available at `http://localhost:3000`.

### Available Scripts

- `npm run dev` - Start development server with hot-reload
- `npm run build` - Build for production
- `npm run emulators` - Start Firebase emulators
- `npm run emulators:data` - Start Firebase emulators with data persistence
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors automatically
- `npm run format:check` - Check code formatting
- `npm run format` - Format code with Prettier

## Quality Assurance

### Code Quality

- **Code Style**: ESLint is configured for Vue 3 and Nuxt best practices, Prettier handles code formatting, and TypeScript is used for type safety (though most files are `.vue` or `.js`)
- **Editor Setup**: It's recommended to set up ESLint and Prettier in your editor for automatic formatting and linting
- **Best Practices**: Follow existing code style and component patterns

### Testing & Internationalization

- **Testing**: Test on multiple devices and browsers (including PWA installation on mobile)
- **Internationalization**: Add translations for new strings in all locale files

### Monitoring & Analytics

- **Analytics & UX**: PostHog (respects cookie consent) and Umami (privacy analytics)
- **Bug Detection**: PostHog (Sentry may be added again in the future)
- **Performance, Accessibility & SEO**: PostHog, Lighthouse and Google Search Console

### Dependency Management

- Dependabot notifies about dependencies
- Dependency updates, migration to new versions and other checks are mainly handled by the maintainer (`npm outdated`, `npm update --save`, `npm audit`)

## Production

### Build

```bash
npm run build
```

### Firebase Configuration for Production

For production deployment, you need:

1. A Firebase project with Realtime Database enabled
2. Authentication enabled with Google and Email/Password providers
3. Database rules configured (see `database.rules.json`)
4. Environment variables configured (see Deployment section)

#### Firebase Admin SDK Setup

For server-side operations (license validation, data writes, rate limiting), you need Firebase Admin SDK credentials configured via environment variables.

**For Local Development with Emulators:**

- Admin SDK credentials are **NOT required**
- The Admin SDK will automatically connect to emulators
- Just run `npm run emulators:data` and `npm run dev`

**For Production (Environment Variables Required):**

1. **Get Service Account Credentials:**
   - Go to Firebase Console > Project Settings > Service Accounts
   - Click "Generate New Private Key"
   - Download the JSON file

2. **Extract values from your service account JSON:**
   - `project_id` → `FIREBASE_ADMIN_PROJECT_ID`
   - `client_email` → `FIREBASE_ADMIN_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_ADMIN_PRIVATE_KEY` (copy the entire value including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`)

3. **Set Environment Variables:**
   - **Local Development (when not using emulators):** Add to your `.env` file (see `.env.example` for reference)
   - **Production/Vercel:** Add to your Vercel project settings:
     - Go to your Vercel project settings
     - Navigate to Environment Variables
     - Add each variable:
       - `FIREBASE_ADMIN_PROJECT_ID`
       - `FIREBASE_ADMIN_CLIENT_EMAIL`
       - `FIREBASE_ADMIN_PRIVATE_KEY`
     - For the private key, paste it as-is (Vercel handles newlines correctly)

**Note:** Environment variables are the recommended and only supported method for configuring Firebase Admin SDK credentials.

**License Key:**

- Set `PKU_TOOLS_LICENSE_KEY` to your premium license key (server-side only, never exposed to client)

See `server/config/README.md` for detailed setup instructions.

### Deployment

The app can be deployed to various platforms. For Vercel:

1. Connect your repository to Vercel
2. Add environment variables in the Vercel dashboard (create `.env` from `.env.example` for local reference)
3. Deploy (automatic on push to main branch)

## Architecture

### State Management

The app uses Pinia for state management with a single main store (`stores/index.js`) that manages:

- **User authentication state**
- **pheDiary**: Array of daily diary entries
- **labValues**: Array of blood test results
- **ownFood**: Array of user-created custom foods
- **settings**: User preferences and configuration

### Data Flow

1. User authenticates via Firebase Auth
2. Store initializes Firebase Realtime Database listeners for read operations
3. Data changes trigger real-time updates to the store
4. Vue components reactively update based on store state
5. User write actions (save, update, delete) go through server API routes:
   - Client gets Firebase ID token
   - Server validates token and input data (Zod schemas)
   - Server performs operations using Firebase Admin SDK
   - Firebase Realtime Database listeners detect changes and update store

### Real-time Sync

Firebase Realtime Database listeners (`onValue`) are set up in the store's `initRef()` method. These listeners automatically sync data across all user's devices in real-time. Write operations go through server API routes for security and validation, but reads continue to use real-time listeners for instant updates.

### Server API Architecture

The application uses Nuxt server routes for all write operations to provide:

- **Security**: Server-side validation and authentication
- **Input Validation**: Zod schemas ensure data integrity
- **License Validation**: Server-side license checks (not exposed to client)
- **Rate Limiting**: Can be implemented server-side for API protection
- **Error Handling**: Consistent error responses with proper HTTP status codes

All server routes:

- Require Bearer token authentication (Firebase ID tokens)
- Validate input using Zod schemas (`server/types/schemas.ts`)
- Use Firebase Admin SDK for database operations
- Return consistent JSON responses with success/error states

The `useApi` composable (`app/composables/useApi.ts`) provides a unified interface for calling server APIs from client components.

### Food Database

The food database is stored as static JSON at `/public/data/usda-phe-kcal.json`. It includes:

- Multilingual food names (en, de, es, fr)
- Phe values (in grams, converted to mg for display)
- Calorie values
- Emoji representations

User's custom foods are stored in Firebase and merged with the static database during search.

**Database Creation Process**: The food database was created using a complex AI workflow that combines two USDA database exports (phenylalanine values and calorie values). The AI workflow was necessary to match appropriate icons to food items. Translations were added using Google Docs. The process involves Python transformations to combine the USDA data sources and convert CSV to JSON format. Previously, the database was created using various Python transformations, which have since been replaced by the current AI workflow approach.

## Additional Information

### Internationalization

The app supports 4 languages with localized:

- Routes (e.g., `/diary` → `/tagebuch` in German)
- Content (via `i18n/locales/*.json`)
- Date formatting (via date-fns locales)
- Chart labels (via ApexCharts locales)

### PWA Features

- **Web Manifest**: Enables app installation on mobile and desktop devices
- **TWA Support**: Available as a Trusted Web Activity on Google Play Store
- **Safe Area Insets**: Support for notched devices
- **Responsive Design**: Mobile-first approach

### Privacy & Compliance

- **Health Data Consent**: Required before saving diary entries (GDPR compliance)
- **Cookie Consent**: User choice for analytics tracking
- **Consent History**: Tracks consent changes over time
- **Data Storage**: All user data stored in Firebase (user-specific paths)

### License System

The app uses a freemium model with a free tier (limited diary entries) and an optional license key for unlimited access. License validation is performed server-side via `/api/license/validate` to prevent client-side tampering. The license key is stored server-side and never exposed to the client.

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
