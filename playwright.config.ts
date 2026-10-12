import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:3107', headless: true, channel: 'chrome' },
  webServer: [
    {
      command: 'node tests/fixtures/supabase.mjs',
      url: 'http://127.0.0.1:3108/health',
      reuseExistingServer: false,
    },
    {
      command: 'npm run dev -- --port 3107',
      url: 'http://127.0.0.1:3107',
      reuseExistingServer: false,
      env: {
        APP_URL: 'http://127.0.0.1:3107',
        CLIENTS_FILE: 'tests/fixtures/clients.json',
        GROQ_API_KEY: '',
        BUSINESS_STORE: 'file',
        SUPABASE_URL: 'http://127.0.0.1:3108',
        SUPABASE_PUBLISHABLE_KEY: 'test-publishable',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role',
        ADMIN_USER_ID: '8531f880-9cd9-44f5-8b86-a71a032eafed',
        REVIEW_TOKEN_ENCRYPTION_KEY:
          'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
      timeout: 120000,
    },
  ],
  reporter: 'list',
});
