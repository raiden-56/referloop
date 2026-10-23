import { expect, type Page } from '@playwright/test';

export const SEED_PASSWORD = 'ReferLoop2026!';
const MAILPIT = process.env.MAILPIT_URL ?? 'http://localhost:8025';

export async function signIn(page: Page, email: string, password = SEED_PASSWORD) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: 'Open account menu' })).toBeVisible();
}

export async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Open account menu' }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(
    page
      .getByRole('link', { name: 'Sign in' })
      .or(page.getByRole('button', { name: 'Sign in' }))
      .first(),
  ).toBeVisible();
}

/** Polls Mailpit for the newest email to `to` and returns the first link containing `pathPart`. */
export async function linkFromEmail(to: string, pathPart: string): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}&limit=5`);
    const body = (await res.json()) as { messages: { ID: string }[] };
    for (const msg of body.messages ?? []) {
      const full = (await (await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`)).json()) as { Text: string };
      const match = new RegExp(`https?://\\S*${pathPart}\\S*`).exec(full.Text);
      if (match) return match[0];
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No email to ${to} containing ${pathPart}`);
}

/** Captures URLs passed to window.open (used to assert the WhatsApp link without leaving the page). */
export async function captureWindowOpen(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __opened: string[] };
    w.__opened = [];
    window.open = (() => {
      const fake = {
        opener: null as unknown,
        location: {
          set href(v: string) {
            w.__opened.push(v);
          },
        },
      };
      return fake as unknown as Window;
    }) as typeof window.open;
  });
}

export const openedUrls = (page: Page) => page.evaluate(() => (window as unknown as { __opened: string[] }).__opened);
