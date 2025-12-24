# Firebase Admin SDK Configuration

Firebase Admin SDK credentials are configured using environment variables. This directory is kept for reference but is no longer used for storing credential files.

## Local Development with Emulators

**No credentials required!** When using Firebase emulators, the Admin SDK automatically connects without credentials.

Just run:
```bash
npm run emulators:data
npm run dev
```

## Local Development (without emulators) or Production

You need to set environment variables with your Firebase service account credentials.

1. **Get your service account JSON file:**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Select your project
   - Go to Project Settings > Service Accounts
   - Click "Generate New Private Key"
   - Download the JSON file

2. **Extract values from the JSON file:**
   - `project_id` → `FIREBASE_ADMIN_PROJECT_ID`
   - `client_email` → `FIREBASE_ADMIN_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_ADMIN_PRIVATE_KEY` (copy the entire value including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`)

3. **Set Environment Variables:**

   **For local development:** Add to your `.env` file (see `.env.example` in the project root for reference)

   **For production (Vercel):**
   - Go to your Vercel project settings
   - Navigate to Environment Variables
   - Add each variable:
     - `FIREBASE_ADMIN_PROJECT_ID`
     - `FIREBASE_ADMIN_CLIENT_EMAIL`
     - `FIREBASE_ADMIN_PRIVATE_KEY`
   - For the private key, paste it as-is (Vercel handles newlines correctly)

**Note:** Environment variables are the recommended and only supported method for configuring Firebase Admin SDK credentials.

