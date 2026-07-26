import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Restore spies and reset mock state between tests, so a stubbed
    // implementation can't leak into the next one. Keeps per-file cleanup out of
    // the test bodies. Globals are deliberately not unstubbed: the server
    // harness installs them once per file for every test in it.
    restoreMocks: true
  }
})
