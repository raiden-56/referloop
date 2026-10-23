import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'vitest/config';

const fromFile = loadEnv({ path: path.resolve(import.meta.dirname, '../../.env'), quiet: true }).parsed ?? {};
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? fromFile.TEST_DATABASE_URL ?? 'postgresql://referloop:referloop@localhost:5442/referloop_test?schema=public';

// globalSetup runs in this process, so point it at the test database too.
process.env.DATABASE_URL = testDatabaseUrl;

export default defineConfig({
  test: {
    globalSetup: ['./tests/globalSetup.ts'],
    setupFiles: ['./tests/setup.ts'],
    // Integration tests share one database, so files run one at a time.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: testDatabaseUrl,
      EMAIL_TRANSPORT: 'memory',
      APP_URL: 'http://localhost:5180',
      CORS_ORIGINS: 'http://localhost:5180',
      SESSION_SECRET: 'test-secret-that-is-long-enough-for-hmac-0123456789',
      COOKIE_SECURE: 'false',
      RATE_LIMIT_SCALE: '50',
      LOG_LEVEL: 'silent',
    },
  },
});
