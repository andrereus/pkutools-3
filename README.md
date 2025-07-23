# PKU Tools

PKU Tools is a nutrition app for low-phenylalanine diets aimed at people with PKU. It combines a calculator, pencil, paper and nutritional table.

## Features

- 🔍 Food Search
- 📷 Barcode Scanner
- 📱 Phenylalanine Calculator
- ➗ Protein Calculator
- 🍎 Own Foods
- 📝 Phe Log
- 📅 Phe Diary
- 📈 Lab Values
- 🤖 Assistant
- 🌍 Multi-language Support
- 📱 PWA Support
- 🔄 Real-time Sync
- 🌓 Dark Mode

## Tech Stack

- **Framework**: Nuxt
- **Styling**: Tailwind
- **State Management**: Pinia
- **Internationalization**: I18n
- **Server**: Vercel
- **Authentication**: Firebase
- **Database**: Firebase

## Setup

Make sure to have npm, pnpm, yarn or bun and install dependencies:

```bash
npm install
```

Create a `.env` from `.env.example`.

## Development Server

Start the development server on `http://localhost:3000`:

```bash
npm run dev
```

## Production

Build the application for production:

```bash
npm run build
```

Locally preview production build:

```bash
npm run preview
```

## Notes

### Modules not used yet

- nuxt-headlessui is not Nuxt 4 compatible yet
- @nuxtjs/tailwindcss doesn't fully support Nuxt 4 yet

### Not set up yet

- firebase emulators
- posthog
- sentry
- i18n

## Contributing

Contributions are welcome.
