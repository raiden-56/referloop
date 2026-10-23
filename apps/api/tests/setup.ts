import { afterAll, beforeEach } from 'vitest';
import { sentEmails } from '../src/lib/email.js';
import { prisma } from '../src/lib/prisma.js';
import { invalidateSettingsCache } from '../src/modules/settings/settings.service.js';

const TABLES = [
  'referral_requests',
  'notifications',
  'saved_jobs',
  'job_reports',
  'job_status_history',
  'job_edit_history',
  'jobs',
  'job_categories',
  'audit_logs',
  'user_sessions',
  'email_verification_tokens',
  'password_reset_tokens',
  'app_settings',
  'users',
];

beforeEach(async () => {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(', ')} CASCADE`);
  invalidateSettingsCache();
  sentEmails.length = 0;
});

afterAll(async () => {
  await prisma.$disconnect();
});
