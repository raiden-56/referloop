import type { AppSettings, PublicConfig } from '@referloop/shared';
import { prisma } from '../../lib/prisma.js';

const CACHE_MS = 15_000;
let cache: { value: AppSettings; at: number } | undefined;
let inflight: Promise<AppSettings> | undefined;

export function getSettings(): Promise<AppSettings> {
  if (cache && Date.now() - cache.at < CACHE_MS) return Promise.resolve(cache.value);
  // Concurrent callers share one load instead of racing each other.
  inflight ??= loadSettings().finally(() => {
    inflight = undefined;
  });
  return inflight;
}

async function loadSettings(): Promise<AppSettings> {
  let row = await prisma.appSetting.findUnique({ where: { id: 1 } });
  if (!row) {
    // ON CONFLICT DO NOTHING: safe even if another API instance creates the row at the same moment.
    await prisma.appSetting.createMany({ data: [{ id: 1 }], skipDuplicates: true });
    row = await prisma.appSetting.findUniqueOrThrow({ where: { id: 1 } });
  }
  const value: AppSettings = {
    publicBrowsingEnabled: row.publicBrowsingEnabled,
    registrationEnabled: row.registrationEnabled,
    allowedEmailDomains: row.allowedEmailDomains,
    staleAfterDays: row.staleAfterDays,
    notifyCreatorOnEdit: row.notifyCreatorOnEdit,
    notifySaversOnStatusChange: row.notifySaversOnStatusChange,
    notifyReporterOnResolution: row.notifyReporterOnResolution,
  };
  cache = { value, at: Date.now() };
  return value;
}

export async function updateSettings(input: AppSettings, actorId: string): Promise<AppSettings> {
  await getSettings(); // ensures the row exists
  await prisma.appSetting.update({ where: { id: 1 }, data: { ...input, updatedById: actorId } });
  invalidateSettingsCache();
  return getSettings();
}

export function invalidateSettingsCache() {
  cache = undefined;
}

export async function getPublicConfig(): Promise<PublicConfig> {
  const [settings, categories] = await Promise.all([
    getSettings(),
    prisma.jobCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, slug: true },
    }),
  ]);
  return {
    publicBrowsingEnabled: settings.publicBrowsingEnabled,
    registrationEnabled: settings.registrationEnabled,
    allowedEmailDomains: settings.allowedEmailDomains,
    categories,
  };
}

export function isEmailDomainAllowed(email: string, allowed: string[]): boolean {
  if (allowed.length === 0) return true;
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  return allowed.some((d) => domain === d || domain.endsWith(`.${d}`));
}
