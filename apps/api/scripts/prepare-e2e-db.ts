/**
 * Prepares the disposable end-to-end database: applies migrations, empties every table and seeds
 * sample data. Refuses to touch any database whose name does not contain "e2e" or "test".
 */
import { execSync } from 'node:child_process';
import path from 'node:path';

const url = process.env.DATABASE_URL ?? '';
const dbName = /\/([^/?]+)(\?|$)/.exec(url)?.[1] ?? '';
if (!/e2e|test/i.test(dbName)) {
  console.error(`Refusing to reset "${dbName || url}": only e2e/test databases may be prepared by this script.`);
  process.exit(1);
}

const apiRoot = path.resolve(import.meta.dirname, '..');
const run = (cmd: string) => execSync(cmd, { cwd: apiRoot, stdio: 'inherit', env: process.env });

run('npx prisma migrate deploy');

const { prisma } = await import('../src/lib/prisma.js');
const tables = await prisma.$queryRaw<{ tablename: string }[]>`
  SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
if (tables.length) {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((t) => `"${t.tablename}"`).join(', ')} CASCADE`);
}
await prisma.$disconnect();
console.log(`Emptied ${tables.length} tables in ${dbName}.`);

run('npx tsx prisma/seed.ts');
