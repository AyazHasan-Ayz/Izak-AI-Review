import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:3107', headless: true, channel: 'chrome' },
  webServer: {
    command: 'npm run dev -- --port 3107',
    url: 'http://127.0.0.1:3107',
    reuseExistingServer: false,
    env: {
      APP_URL: 'http://127.0.0.1:3107',
      CLIENTS_FILE: 'tests/fixtures/clients.json',
      GROQ_API_KEY: '',
    },
    timeout: 120000,
  },
  reporter: 'list',
});
