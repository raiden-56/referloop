import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against a production-style server: the API serves the built web app on one
 * origin, uses the disposable `referloop_e2e` database and sends real SMTP email to Mailpit.
 * Prerequisite: `npm run db:up` (Postgres + Mailpit).
 */
const PORT = 4100;
const BASE_URL = `http://localhost:${PORT}`;
const DATABASE_URL = process.env.E2E_DATABASE_URL ?? 'postgresql://referloop:referloop@localhost:5442/referloop_e2e?schema=public';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile\.spec/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec/ },
  ],
  webServer: {
    command: 'npm run build -w @referloop/web && npm run e2e:prepare -w @referloop/api && npm run start:e2e -w @referloop/api',
    url: `${BASE_URL}/api/v1/health`,
    timeout: 240_000,
    reuseExistingServer: false,
    stdout: 'pipe',
    env: {
      NODE_ENV: 'development',
      LOG_LEVEL: 'warn',
      PORT: String(PORT),
      DATABASE_URL,
      APP_URL: BASE_URL,
      CORS_ORIGINS: BASE_URL,
      SERVE_WEB: 'true',
      COOKIE_SECURE: 'false',
      EMAIL_TRANSPORT: 'smtp',
      SMTP_HOST: '127.0.0.1',
      SMTP_PORT: '1025',
      SMTP_SECURE: 'false',
      RATE_LIMIT_SCALE: '20',
    },
  },
});
