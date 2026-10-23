import { expect, test, type Page } from '@playwright/test';
import { signIn } from './helpers';

const noHorizontalOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

test('explore jobs works on a phone: filters drawer, cards and navigation', async ({ page }) => {
  await page.goto('/jobs');
  await expect(page.getByRole('heading', { name: 'Explore jobs' })).toBeVisible();
  await expect(page.locator('article').first()).toBeVisible();
  expect(await noHorizontalOverflow(page)).toBe(true);

  await page.getByRole('button', { name: 'Filters' }).click();
  await page.getByLabel('Remote').click();
  await expect(page.getByLabel('Remote')).toBeChecked();
  await page.getByRole('button', { name: /Show \d+ results/ }).click();
  await expect(page).toHaveURL(/workMode=REMOTE/);
  await expect(page.locator('article').first()).toBeVisible();

  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Explore Jobs' })).toBeVisible();
});

test('job details and the post form fit a phone screen', async ({ page }) => {
  await page.goto('/jobs');
  await page.locator('article').first().getByRole('link', { name: 'View details' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await noHorizontalOverflow(page)).toBe(true);

  await signIn(page, 'meera@referloop.dev');
  await page.goto('/jobs/new');
  await expect(page.getByRole('heading', { name: 'Post a job' })).toBeVisible();
  expect(await noHorizontalOverflow(page)).toBe(true);
});

test('tablet layout keeps the board readable', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto('/jobs');
  await expect(page.locator('article').first()).toBeVisible();
  expect(await noHorizontalOverflow(page)).toBe(true);
  await signIn(page, 'admin@referloop.dev');
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Admin Console' })).toBeVisible();
  expect(await noHorizontalOverflow(page)).toBe(true);
});
