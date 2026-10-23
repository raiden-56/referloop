import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

// Same relative depth from src/config and dist/config: both resolve to the repository root.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
loadEnv({ path: path.join(repoRoot, '.env'), quiet: true });

const bool = (fallback: boolean) =>
  z
    .enum(['true', 'false', '1', '0', ''])
    .optional()
    .transform((v) => (v === undefined || v === '' ? fallback : v === 'true' || v === '1'));

const isProduction = process.env.NODE_ENV === 'production';

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    APP_URL: z.url().default('http://localhost:5180'),
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:5180')
      .transform((v) =>
        v
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean),
      ),
    SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
    SESSION_TTL_HOURS: z.coerce
      .number()
      .int()
      .min(1)
      .max(24 * 90)
      .default(168),
    COOKIE_SECURE: bool(isProduction),
    TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
    SERVE_WEB: bool(isProduction),
    EMAIL_TRANSPORT: z.enum(['smtp', 'console', 'memory']).default('console'),
    EMAIL_FROM: z.string().default('ReferLoop <no-reply@referloop.local>'),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_SECURE: bool(false),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    RATE_LIMIT_SCALE: z.coerce.number().positive().default(1),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    if (env.EMAIL_TRANSPORT !== 'smtp') {
      ctx.addIssue({
        code: 'custom',
        path: ['EMAIL_TRANSPORT'],
        message: 'Production requires EMAIL_TRANSPORT=smtp so email verification cannot be bypassed',
      });
    }
    if (!env.SMTP_HOST) ctx.addIssue({ code: 'custom', path: ['SMTP_HOST'], message: 'SMTP_HOST is required in production' });
    if (/dev-only|change-me/i.test(env.SESSION_SECRET)) {
      ctx.addIssue({ code: 'custom', path: ['SESSION_SECRET'], message: 'Set a unique random SESSION_SECRET in production' });
    }
  });

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`Invalid environment configuration:\n${problems}`);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
export const paths = {
  repoRoot,
  webDist: path.join(repoRoot, 'apps/web/dist'),
};
