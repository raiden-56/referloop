/**
 * Returns true when `value` is an absolute http(s) URL that is safe to render as an outbound link.
 * Rejects javascript:/data: schemes, embedded credentials and hosts without a dot (e.g. `localhost`).
 */
export function isSafeExternalUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  if (url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  if (!host.includes('.') || host.endsWith('.local') || host.endsWith('.internal')) return false;
  // Bare IPv4 addresses are almost never legitimate careers pages and are a common phishing vector.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
  return true;
}

/** Lower-cases and trims an email address; used for uniqueness checks and lookups. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Builds a URL-safe slug fragment from free text. */
export function slugify(text: string, maxLength = 60): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
}
