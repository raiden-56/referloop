import request from 'supertest';
import type { JobDetail, JobInput } from '@referloop/shared';
import { createApp } from '../src/app.js';
import { sentEmails } from '../src/lib/email.js';
import { hashPassword } from '../src/lib/password.js';
import { prisma } from '../src/lib/prisma.js';

export const app = createApp();
export const PASSWORD = 'CorrectHorse42';

let passwordHash: Promise<string> | undefined;

export async function createUser(
  overrides: Partial<{ name: string; email: string; role: 'MEMBER' | 'ADMIN'; verified: boolean; suspended: boolean }> = {},
) {
  passwordHash ??= hashPassword(PASSWORD);
  const n = Math.random().toString(36).slice(2, 8);
  return prisma.user.create({
    data: {
      name: overrides.name ?? `Member ${n}`,
      email: overrides.email ?? `member-${n}@example.com`,
      passwordHash: await passwordHash,
      role: overrides.role ?? 'MEMBER',
      emailVerifiedAt: overrides.verified === false ? null : new Date(),
      accountStatus: overrides.suspended ? 'SUSPENDED' : 'ACTIVE',
    },
  });
}

/** A cookie-carrying client that automatically sends the CSRF header on state-changing requests. */
export interface Client {
  agent: ReturnType<typeof request.agent>;
  get(url: string): request.Test;
  post(url: string, body?: object): request.Test;
  patch(url: string, body?: object): request.Test;
  put(url: string, body?: object): request.Test;
  delete(url: string): request.Test;
}

export async function client(): Promise<Client> {
  const agent = request.agent(app);
  const res = await agent.get('/api/v1/auth/csrf').expect(200);
  const csrf = res.body.csrfToken as string;
  const withCsrf = (t: request.Test) => t.set('X-CSRF-Token', csrf);
  return {
    agent,
    get: (url) => agent.get(url),
    post: (url, body = {}) => withCsrf(agent.post(url)).send(body),
    patch: (url, body = {}) => withCsrf(agent.patch(url)).send(body),
    put: (url, body = {}) => withCsrf(agent.put(url)).send(body),
    delete: (url) => withCsrf(agent.delete(url)),
  };
}

export async function login(email: string, password = PASSWORD): Promise<Client> {
  const c = await client();
  await c.post('/api/v1/auth/login', { email, password }).expect(200);
  return c;
}

export async function loggedInUser(opts: Parameters<typeof createUser>[0] = {}) {
  const user = await createUser(opts);
  return { user, api: await login(user.email) };
}

/** Extracts the `token` query parameter from the most recent email sent to `to`. */
export function tokenFromEmail(to: string): string {
  const mail = [...sentEmails].reverse().find((m) => m.to === to);
  if (!mail) throw new Error(`No email sent to ${to}`);
  const match = /token=([A-Za-z0-9_-]+)/.exec(mail.text);
  if (!match) throw new Error(`No token in email "${mail.subject}"`);
  return match[1]!;
}

export const validJob = (overrides: Partial<JobInput> = {}): JobInput => ({
  title: 'Senior Software Engineer',
  companyName: 'Example Company',
  location: 'Bangalore',
  workMode: 'HYBRID',
  employmentType: 'FULL_TIME',
  experienceMin: 3,
  experienceMax: 5,
  summary: 'Build the core referral product with a small senior team.',
  description: 'You will design, build and operate the services and interfaces that power our product for millions of users.',
  requiredSkills: ['React', 'TypeScript', 'Node.js'],
  preferredSkills: [],
  referralAvailable: true,
  posterCanRefer: true,
  applicationUrl: 'https://careers.example.com/jobs/123',
  ...overrides,
});

export async function postJob(api: Client, overrides: Partial<JobInput> = {}) {
  const res = await api.post('/api/v1/jobs', validJob(overrides)).expect(201);
  return res.body.job as JobDetail;
}
