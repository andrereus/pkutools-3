# PKU Tools

> **Note**: This README is a work in progress and may be updated with additional information.

PKU Tools is a comprehensive Progressive Web App (PWA) designed to help people with Phenylketonuria (PKU) manage their low-phenylalanine diet. It combines a calculator, food diary, nutritional database, and tracking tools into a single, easy-to-use application.

## About PKU

Phenylketonuria (PKU) is a genetic condition that requires individuals to follow a strict low-phenylalanine diet throughout their lives. PKU Tools helps users track their daily Phe intake, search for foods, calculate nutritional values, and monitor their diet compliance.

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

- **📅 Diary**: Daily food log with:
  - Date navigation (view past and future days)
  - Progress bars showing Phe and calorie consumption vs. daily limits
  - Quick-add suggestions based on recently used foods (recency-weighted algorithm)
  - Edit and delete entries

- **📈 Blood Values**: Track and visualize lab results:
  - Record Phe and tyrosine blood values
  - Interactive charts with ApexCharts
  - Export data as CSV, SVG, or PNG
  - Multilingual chart labels

- **📖 Diet Report**: Generate comprehensive reports on dietary patterns and compliance.

- **🍎 Own Foods**: Create and manage custom food entries with:
  - Custom Phe and calorie values
  - Icon selection from 307+ food icons
  - Automatically included in food search results

- **🤖 Assistant**: AI-powered assistant for dietary guidance (currently in development).

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

### State Management & Data

- **State Management**: [Pinia](https://pinia.vuejs.org/)
- **Database**: [Firebase Realtime Database](https://firebase.google.com/docs/database)
- **Authentication**: [Firebase Authentication](https://firebase.google.com/docs/auth) (Google OAuth + Email/Password)
- **Search**: [Fuse.js](https://fusejs.io/) for fuzzy search

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
│   ├── assets/          # Static assets
│   │   ├── css/        # Global styles
│   │   ├── data/       # Food icons mapping
│   │   └── images/     # Images and icons
│   ├── components/      # Reusable Vue components
│   ├── layouts/         # Layout components
│   ├── pages/           # Route pages (file-based routing)
│   └── plugins/          # Nuxt plugins (Firebase, ApexCharts)
├── i18n/
│   └── locales/         # Translation files (en, de, es, fr)
├── public/
│   ├── data/            # Static food database (JSON/CSV)
│   ├── images/          # Public images and food icons
│   └── videos/          # Demo videos
├── stores/               # Pinia stores
├── nuxt.config.ts        # Nuxt configuration
├── package.json          # Dependencies and scripts
└── tsconfig.json         # TypeScript configuration
```

## Setup

### Prerequisites

- Node.js 18+ (or compatible runtime)
- npm, pnpm, yarn, or bun
- Firebase project with Realtime Database enabled

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd pkutools-3
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the root directory. Copy `.env.example` and fill in your Firebase configuration values.

4. Configure Firebase:
   - Enable Authentication with Google and Email/Password providers
   - Create a Realtime Database
   - Set up database rules (see Firebase Security Rules below)

**Note**: For local development, you can optionally set up a local Firebase emulator. This was available in Version 2 but hasn't been configured yet for the Nuxt 4 migration. It can be set up if needed for local development without affecting the production database.

### Firebase Security Rules

Security rules for Realtime Database:

```json
{
  "rules": {
    "$uid": {
      ".read": "$uid === auth.uid",
      ".write": "$uid === auth.uid"
    }
  }
}
```

## Development

### Start Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

### Available Scripts

- `npm run dev` - Start development server with hot-reload
- `npm run build` - Build for production
- `npm run generate` - Generate static site
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors automatically
- `npm run format:check` - Check code formatting
- `npm run format` - Format code with Prettier

### Code Style

- ESLint is configured for Vue 3 and Nuxt best practices
- Prettier handles code formatting
- TypeScript is used for type safety (though most files are `.vue` or `.js`)

## Production

### Build

```bash
npm run build
```

### Static Generation

For static site generation:

```bash
npm run generate
```

Output will be in `.output/public/`.

### Preview Production Build

To preview the production build locally:

```bash
npm run preview
```

### Deployment

The app can be deployed to various platforms. For Vercel deployment:

1. Connect your repository to Vercel
2. Add environment variables in Vercel dashboard
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
2. Store initializes Firebase Realtime Database listeners
3. Data changes trigger real-time updates to the store
4. Vue components reactively update based on store state
5. User actions write directly to Firebase, triggering listeners

### Real-time Sync

Firebase Realtime Database listeners (`onValue`) are set up in the store's `initRef()` method. These listeners automatically sync data across all user's devices in real-time.

### Food Database

The food database is stored as static JSON at `/public/data/usda-phe-kcal.json`. It includes:

- Multilingual food names (en, de, es, fr)
- Phe values (in grams, converted to mg for display)
- Calorie values
- Emoji representations

User's custom foods are stored in Firebase and merged with the static database during search.

**Database Creation Process**: The food database was created using a complex AI workflow that combines two USDA database exports (phenylalanine values and calorie values). The AI workflow was necessary to match appropriate icons to food items. Translations were added using Google Docs. The process involves Python transformations to combine the USDA data sources and convert CSV to JSON format. Previously, the database was created using various Python transformations, which have since been replaced by the current AI workflow approach.

## Internationalization

The app supports 4 languages with localized:

- Routes (e.g., `/diary` → `/tagebuch` in German)
- Content (via `i18n/locales/*.json`)
- Date formatting (via date-fns locales)
- Chart labels (via ApexCharts locales)

## PWA Features

- **Web Manifest**: Enables app installation on mobile and desktop devices
- **TWA Support**: Available as a Trusted Web Activity on Google Play Store
- **Safe Area Insets**: Support for notched devices
- **Responsive Design**: Mobile-first approach

## Privacy & Compliance

- **Health Data Consent**: Required before saving diary entries (GDPR compliance)
- **Cookie Consent**: User choice for analytics tracking
- **Consent History**: Tracks consent changes over time
- **Data Storage**: All user data stored in Firebase (user-specific paths)

## License System

The app uses a freemium model with a free tier (limited diary entries) and an optional license key for unlimited access.

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Ensure code is properly formatted and linted (recommended: set up ESLint and Prettier in your editor)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

**Important**: When you open a pull request, you will be required to sign a Contributor License Agreement (CLA) through CLA Assistant. This is a one-time process that ensures your contributions can be used in the project.

### Development Notes

- Follow existing code style and component patterns
- Add translations for new strings in all locale files
- Test on multiple devices and browsers (including PWA installation on mobile)

## License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**. See the [LICENSE.txt](LICENSE.txt) file for the full license text.

## Dependency Notes

- `@nuxtjs/tailwindcss` doesn't fully support Nuxt 4 yet, so Tailwind is configured via Vite plugin instead

## Support

- **Website**: [pkutools.com](https://pkutools.com)
- **Facebook**: [@pkutools](https://www.facebook.com/pkutools)
- **YouTube**: [@pkutools](https://www.youtube.com/@pkutools)

---

Made with ❤️ for the PKU community
