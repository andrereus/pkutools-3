# Firebase Admin SDK Configuration

This directory is for Firebase Admin SDK service account JSON files (local development only).

## Local Development Setup

1. **Get your service account JSON file:**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Select your project
   - Go to Project Settings > Service Accounts
   - Click "Generate New Private Key"
   - Download the JSON file

2. **Place the file here:**
   ```
   server/config/firebase-service-account.json
   ```

3. **The file will be automatically detected and used** (no environment variables needed for local development)

**Important:** This file is gitignored and should NEVER be committed to the repository.

## Production/Vercel Setup

For production deployments (like Vercel), you cannot upload files. Instead, use environment variables:

1. **Extract values from your service account JSON:**
   - `project_id` → `FIREBASE_ADMIN_PROJECT_ID`
   - `client_email` → `FIREBASE_ADMIN_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_ADMIN_PRIVATE_KEY` (keep the `\n` characters)

2. **Add to Vercel:**
   - Go to your Vercel project settings
   - Navigate to Environment Variables
   - Add each variable:
     - `FIREBASE_ADMIN_PROJECT_ID`
     - `FIREBASE_ADMIN_CLIENT_EMAIL`
     - `FIREBASE_ADMIN_PRIVATE_KEY`

3. **For the private key:**
   - Copy the entire `private_key` value from the JSON (including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`)
   - Paste it as-is into Vercel (it will handle the newlines correctly)
   - Or if you need to escape newlines, use `\n` in the value

## Priority

The code will try to load credentials in this order:
1. JSON file at `server/config/firebase-service-account.json` (local development)
2. Environment variables (production/Vercel)

If neither is found, the app will throw an error.

