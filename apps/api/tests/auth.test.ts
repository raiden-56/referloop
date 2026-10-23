import { describe, expect, it } from 'vitest';
import { sentEmails } from '../src/lib/email.js';
import { prisma } from '../src/lib/prisma.js';
import { client, createUser, login, loggedInUser, PASSWORD, tokenFromEmail, validJob } from './helpers.js';

const registration = {
  name: 'Asha Rao',
  email: 'Asha.Rao@Example.com',
  password: 'Sup3rSecretPass',
  confirmPassword: 'Sup3rSecretPass',
  companyName: 'Example Co',
  jobTitle: '',
  acceptTerms: true,
};

describe('registration and email verification', () => {
  it('registers, verifies email and signs in (acceptance 1)', async () => {
    const api = await client();
    await api.post('/api/v1/auth/register', registration).expect(202);

    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'asha.rao@example.com' } });
    expect(user.emailVerifiedAt).toBeNull();
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user.passwordHash).not.toContain(registration.password);
    expect(user.jobTitle).toBeNull();

    // Only the hash of the verification token is stored.
    const token = tokenFromEmail('asha.rao@example.com');
    const stored = await prisma.emailVerificationToken.findFirstOrThrow({ where: { userId: user.id } });
    expect(stored.tokenHash).not.toBe(token);

    await api.post('/api/v1/auth/verify-email', { token }).expect(200);
    // Single use.
    await api.post('/api/v1/auth/verify-email', { token }).expect(400);

    const signedIn = await login('ASHA.RAO@example.com', registration.password);
    const me = await signedIn.get('/api/v1/auth/me').expect(200);
    expect(me.body.user).toMatchObject({ email: 'asha.rao@example.com', emailVerified: true, role: 'MEMBER' });
    expect(me.body.user.passwordHash).toBeUndefined();
  });

  it('does not reveal whether an email is already registered', async () => {
    await createUser({ email: 'taken@example.com' });
    const api = await client();
    const fresh = await api.post('/api/v1/auth/register', { ...registration, email: 'new@example.com' }).expect(202);
    const dup = await api.post('/api/v1/auth/register', { ...registration, email: 'taken@example.com' }).expect(202);
    expect(dup.body).toEqual(fresh.body);
    expect(await prisma.user.count({ where: { email: 'taken@example.com' } })).toBe(1);
    expect(sentEmails.find((m) => m.to === 'taken@example.com')?.subject).toMatch(/sign-up attempt/i);
  });

  it('validates input with field-level messages', async () => {
    const api = await client();
    const res = await api
      .post('/api/v1/auth/register', { ...registration, email: 'nope', password: 'short', confirmPassword: 'x', acceptTerms: false })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Object.keys(res.body.error.fields)).toEqual(expect.arrayContaining(['email', 'password', 'acceptTerms']));
  });

  it('enforces registration policy settings', async () => {
    await prisma.appSetting.create({ data: { id: 1, allowedEmailDomains: ['referloop.dev'] } });
    const api = await client();
    const res = await api.post('/api/v1/auth/register', registration).expect(400);
    expect(res.body.error.fields.email).toMatch(/approved company email/);
  });

  it('prevents unverified users from creating or modifying jobs (acceptance 2)', async () => {
    const { api } = await loggedInUser({ verified: false });
    const res = await api.post('/api/v1/jobs', validJob()).expect(403);
    expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED');

    const { api: verified } = await loggedInUser();
    const job = (await verified.post('/api/v1/jobs', validJob()).expect(201)).body.job;
    await api.patch(`/api/v1/jobs/${job.id}`, { ...validJob(), version: 1 }).expect(403);
    await api.post(`/api/v1/jobs/${job.id}/close`).expect(403);
    await api.post(`/api/v1/jobs/${job.id}/report`, { reason: 'SPAM' }).expect(403);
  });

  it('lets unverified users request a fresh verification link', async () => {
    const { user, api } = await loggedInUser({ verified: false });
    await api.post('/api/v1/auth/resend-verification').expect(202);
    const token = tokenFromEmail(user.email);
    await api.post('/api/v1/auth/verify-email', { token }).expect(200);
    const me = await api.get('/api/v1/auth/me').expect(200);
    expect(me.body.user.emailVerified).toBe(true);
  });
});

describe('sign in and sessions', () => {
  it('uses a generic error for unknown emails and wrong passwords', async () => {
    await createUser({ email: 'real@example.com' });
    const api = await client();
    const wrong = await api.post('/api/v1/auth/login', { email: 'real@example.com', password: 'WrongPass123' }).expect(401);
    const unknown = await api.post('/api/v1/auth/login', { email: 'ghost@example.com', password: 'WrongPass123' }).expect(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it('sets an HttpOnly session cookie and stores only its hash', async () => {
    const user = await createUser();
    const api = await client();
    const res = await api.post('/api/v1/auth/login', { email: user.email, password: PASSWORD }).expect(200);
    const cookie = (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('rl_session='))!;
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    const token = /rl_session=([^;]+)/.exec(cookie)![1]!;
    expect(await prisma.userSession.count({ where: { tokenHash: token } })).toBe(0);
    expect(await prisma.userSession.count({ where: { userId: user.id } })).toBe(1);
  });

  it('locks the account after repeated failures without revealing it', async () => {
    const user = await createUser();
    const api = await client();
    for (let i = 0; i < 10; i++) {
      await api.post('/api/v1/auth/login', { email: user.email, password: `Wrong-${i}-pass` }).expect(401);
    }
    // Correct password is rejected while locked, with the same generic message.
    const locked = await api.post('/api/v1/auth/login', { email: user.email, password: PASSWORD }).expect(401);
    expect(locked.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(sentEmails.some((m) => m.to === user.email && /locked/i.test(m.subject))).toBe(true);
  });

  it('logout revokes the session server-side', async () => {
    const { api } = await loggedInUser();
    await api.get('/api/v1/auth/me').expect(200);
    await api.post('/api/v1/auth/logout').expect(204);
    await api.get('/api/v1/auth/me').expect(401);
  });

  it('rejects state-changing requests without a valid CSRF token', async () => {
    const { api } = await loggedInUser();
    const res = await api.agent.post('/api/v1/jobs').send(validJob()).expect(403);
    expect(res.body.error.code).toBe('CSRF_INVALID');
    await api.agent.post('/api/v1/jobs').set('X-CSRF-Token', 'forged.value').send(validJob()).expect(403);
  });

  it('blocks suspended users from signing in and revokes existing sessions', async () => {
    const { user, api } = await loggedInUser();
    await prisma.user.update({ where: { id: user.id }, data: { accountStatus: 'SUSPENDED' } });
    await api.get('/api/v1/auth/me').expect(401);
    const fresh = await client();
    const res = await fresh.post('/api/v1/auth/login', { email: user.email, password: PASSWORD }).expect(403);
    expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
  });
});

describe('password reset', () => {
  it('resets with a single-use token and signs out every session', async () => {
    const { user, api: oldSession } = await loggedInUser();
    const api = await client();
    const generic = await api.post('/api/v1/auth/forgot-password', { email: user.email }).expect(202);
    const unknown = await api.post('/api/v1/auth/forgot-password', { email: 'nobody@example.com' }).expect(202);
    expect(generic.body).toEqual(unknown.body);

    const token = tokenFromEmail(user.email);
    await api.post('/api/v1/auth/reset-password', { token, password: 'BrandNewPass9', confirmPassword: 'BrandNewPass9' }).expect(200);
    await api.post('/api/v1/auth/reset-password', { token, password: 'AnotherPass99', confirmPassword: 'AnotherPass99' }).expect(400);

    await oldSession.get('/api/v1/auth/me').expect(401);
    const c = await client();
    await c.post('/api/v1/auth/login', { email: user.email, password: PASSWORD }).expect(401);
    await login(user.email, 'BrandNewPass9');
  });

  it('rejects expired reset tokens', async () => {
    const user = await createUser();
    const api = await client();
    await api.post('/api/v1/auth/forgot-password', { email: user.email }).expect(202);
    const token = tokenFromEmail(user.email);
    await prisma.passwordResetToken.updateMany({ where: { userId: user.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const res = await api
      .post('/api/v1/auth/reset-password', { token, password: 'BrandNewPass9', confirmPassword: 'BrandNewPass9' })
      .expect(400);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });
});

describe('profile', () => {
  it('updates profile fields but never role or email', async () => {
    const { user, api } = await loggedInUser();
    const res = await api
      .patch('/api/v1/users/me', { name: 'New Name', companyName: 'Acme', jobTitle: 'Lead', role: 'ADMIN', email: 'x@y.z' })
      .expect(200);
    expect(res.body.user).toMatchObject({ name: 'New Name', companyName: 'Acme', role: 'MEMBER', email: user.email });
  });

  it('changes password after verifying the current one', async () => {
    const { user, api } = await loggedInUser();
    await api
      .post('/api/v1/users/me/password', { currentPassword: 'wrong', newPassword: 'NewPassword12', confirmPassword: 'NewPassword12' })
      .expect(400);
    await api
      .post('/api/v1/users/me/password', { currentPassword: PASSWORD, newPassword: 'NewPassword12', confirmPassword: 'NewPassword12' })
      .expect(200);
    await api.get('/api/v1/auth/me').expect(200); // current session survives
    await login(user.email, 'NewPassword12');
  });
});
