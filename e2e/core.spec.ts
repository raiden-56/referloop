import { expect, test, type Page } from '@playwright/test';
import { captureWindowOpen, linkFromEmail, openedUrls, signIn, signOut } from './helpers';

/**
 * The main ReferLoop journey, run as one ordered story against a real server, database and SMTP:
 * register → verify → post → share → collaborative edit → close → report → admin resolves.
 */
test.describe.configure({ mode: 'serial' });

const stamp = Date.now().toString(36);
const newUser = { name: 'Esha Tester', email: `esha.${stamp}@example.com`, password: 'E2eSecurePass1' };
const jobTitle = `Platform Engineer ${stamp}`;
let jobPath = '';

let page: Page;
test.beforeAll(async ({ browser }, testInfo) => {
  const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  page = await context.newPage();
});
test.afterAll(async () => {
  await page.context().close();
});

test('a new user registers, cannot post until verified, then verifies by email', async () => {
  await page.goto('/register');
  await page.getByLabel('Full name').fill(newUser.name);
  await page.getByLabel('Email address').fill(newUser.email);
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill(newUser.password);
  await page.getByRole('textbox', { name: 'Confirm password' }).fill(newUser.password);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();

  // Unverified members can sign in but not post.
  await signIn(page, newUser.email, newUser.password);
  await expect(page.getByText(/Verify your email address/)).toBeVisible();
  await page.goto('/jobs/new');
  await expect(page.getByRole('heading', { name: 'Verify your email to continue' })).toBeVisible();

  const link = await linkFromEmail(newUser.email, '/verify-email');
  await page.goto(link);
  await expect(page.getByRole('heading', { name: 'Email verified' })).toBeVisible();
});

test('a verified member publishes a job after previewing it', async () => {
  await page.goto('/jobs/new');
  await page.getByLabel('Job title').fill(jobTitle);
  await page.getByLabel('Company name').fill('E2E Corp');
  await page.getByLabel('Location').fill('Pune');
  await page.getByLabel('Min. experience (years)').fill('3');
  await page.getByLabel('Max. experience (years)').fill('6');
  await page.getByLabel('Short summary').fill('Run the Kubernetes platform that powers every product team.');
  await page
    .getByLabel('Full job description')
    .fill('You will design, automate and operate our multi-cluster Kubernetes platform, working with every engineering team.');
  const skills = page.getByLabel('Required skills');
  await skills.fill('Kubernetes');
  await skills.press('Enter');
  await skills.fill('Terraform');
  await skills.press('Enter');
  await page.getByLabel('A referral is available for this role').check();
  await page.getByLabel('I confirm I can personally refer applicants').check();
  await page.getByLabel('Official application URL').fill('https://careers.e2e-corp.example.com/jobs/42');

  await page.getByRole('button', { name: 'Preview & publish' }).click();
  const preview = page.getByRole('dialog', { name: 'Preview your job post' });
  await expect(preview.getByText(jobTitle)).toBeVisible();
  await preview.getByRole('button', { name: 'Publish job' }).click();

  await expect(page.getByRole('heading', { level: 1, name: jobTitle })).toBeVisible();
  await expect(page).toHaveURL(/\/jobs\/platform-engineer-/);
  jobPath = new URL(page.url()).pathname;
  await expect(page.getByText('Active').first()).toBeVisible();
  await expect(page.getByText(`by ${newUser.name}`).first()).toBeVisible();
});

test('sharing produces a WhatsApp message with the job details and link', async () => {
  await captureWindowOpen(page);
  await page.goto(jobPath);
  await page.getByRole('button', { name: 'Share' }).click();
  await page.getByRole('menuitem', { name: 'Share on WhatsApp' }).click();
  await expect.poll(() => openedUrls(page)).toHaveLength(1);
  const [url] = await openedUrls(page);
  expect(url).toMatch(/^https:\/\/wa\.me\/\?text=/);
  const text = decodeURIComponent(url!.split('text=')[1]!);
  expect(text).toContain(`Job Opening: ${jobTitle}`);
  expect(text).toContain('Company: E2E Corp');
  expect(text).toContain('Experience: 3–6 years');
  expect(text).toContain('Skills: Kubernetes, Terraform');
  expect(text).toContain('Status: Active');
  expect(text).toContain(`http://localhost:4100${jobPath}`);
  expect(text).toContain('https://careers.e2e-corp.example.com/jobs/42');
  expect(text).not.toContain(newUser.email);

  await page.getByRole('button', { name: 'Share' }).click();
  await page.getByRole('menuitem', { name: 'Copy job link' }).click();
  await expect(page.getByText('Job link copied to clipboard')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`http://localhost:4100${jobPath}`);
});

test('another member edits the job; the creator stays recorded and history shows the change', async () => {
  await signOut(page);
  await signIn(page, 'arjun@referloop.dev');
  await page.goto(jobPath);
  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  await expect(page.getByText(`Originally posted by ${newUser.name}`)).toBeVisible();
  await page.getByLabel('Job title').fill(`${jobTitle} (Senior)`);
  await page.getByLabel('Reason for changes (optional)').fill('Recruiter confirmed seniority');
  await page.getByRole('button', { name: 'Save changes' }).click();

  await expect(page.getByRole('heading', { level: 1, name: `${jobTitle} (Senior)` })).toBeVisible();
  await expect(page.getByText(`by ${newUser.name}`).first()).toBeVisible();
  await expect(page.getByText('by Arjun Mehta').first()).toBeVisible();

  const history = page.locator('#job-history');
  await expect(history.getByText('Arjun Mehta')).toBeVisible();
  await expect(history.getByText('“Recruiter confirmed seniority”')).toBeVisible();
  await history.getByRole('button', { name: 'View changes' }).first().click();
  await expect(history.getByRole('cell', { name: jobTitle, exact: true })).toBeVisible();
  await expect(history.getByRole('cell', { name: `${jobTitle} (Senior)` })).toBeVisible();
});

test('closing requires confirmation and removes the job from the default search', async () => {
  await page.goto(jobPath);
  await page.getByRole('button', { name: 'Mark as closed' }).click();
  const dialog = page.getByRole('dialog', { name: 'Mark this job as closed?' });
  await dialog.getByLabel('Reason (optional)').fill('Position filled');
  await dialog.getByRole('button', { name: 'Mark as closed' }).click();
  await expect(page.getByText('This position is closed')).toBeVisible();

  await page.goto(`/jobs?q=${stamp}`);
  await expect(page.getByRole('heading', { name: 'No jobs match your search' })).toBeVisible();
  await page.getByRole('button', { name: 'Closed', exact: true }).first().click();
  await expect(page.getByRole('link', { name: `${jobTitle} (Senior)` })).toBeVisible();
});

test('a member reports the job and an administrator resolves it', async () => {
  await page.goto(jobPath);
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Report listing' }).click();
  const dialog = page.getByRole('dialog', { name: 'Report this listing' });
  await dialog.getByLabel('Duplicate listing').check();
  await dialog.getByLabel('Details (optional)').fill('Same role was posted twice');
  await dialog.getByRole('button', { name: 'Submit report' }).click();
  await expect(page.getByText('Thanks — an administrator will review your report.')).toBeVisible();

  // Ordinary members cannot reach the admin console.
  await page.goto('/admin/reports');
  await expect(page).toHaveURL(/\/$/);

  await signOut(page);
  await signIn(page, 'admin@referloop.dev');
  await page.goto('/admin/reports');
  const card = page.locator('.MuiCard-root', { hasText: `${jobTitle} (Senior)` });
  await expect(card.getByText('Same role was posted twice')).toBeVisible();
  await card.getByRole('button', { name: 'Resolve' }).click();
  const resolve = page.getByRole('dialog', { name: 'Resolve report' });
  await resolve.getByLabel('No change to the job').check();
  await resolve.getByLabel('Resolution note').fill('Checked — the other listing was removed already');
  await resolve.getByRole('button', { name: 'Resolve report' }).click();
  await expect(card).toHaveCount(0);

  await page.getByLabel('Show').click();
  await page.getByRole('option', { name: 'Resolved' }).click();
  await expect(
    page.locator('.MuiCard-root', { hasText: `${jobTitle} (Senior)` }).getByText('Checked — the other listing was removed already'),
  ).toBeVisible();
});
