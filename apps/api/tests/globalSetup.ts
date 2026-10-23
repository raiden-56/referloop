import { execSync } from 'node:child_process';
import path from 'node:path';

/** Applies migrations to the dedicated test database once per run. */
export default function setup() {
  const url = process.env.DATABASE_URL;
  if (!url || !/test/i.test(url)) {
    throw new Error(`Refusing to run integration tests against a non-test database: ${url ?? '(unset)'}`);
  }
  execSync('npx prisma migrate deploy', {
    cwd: path.resolve(import.meta.dirname, '..'),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
}
