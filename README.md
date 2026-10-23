# ReferLoop

A community job board where employees share openings from their companies, keep listings accurate together, and offer referrals when they can.

The first release covers five capabilities, each built end to end (UI, API, database, validation, security and tests):

1. **Registration and secure access**: email verification, sign-in, password reset, sessions, suspension.
2. **Posting and collaborative editing**: any verified member can edit any listing. Optimistic locking prevents silent overwrites, and every change is recorded.
3. **Active/Closed status**: confirmed transitions with reasons and status history. A passed deadline or stale listing produces a notice, never an automatic close.
4. **Search, filtering and sharing**: server-side search, filters, sorting and pagination with shareable URLs. Sharing works through WhatsApp, a copied link, copied details or the native share sheet.
5. **History, reporting and administration**: per-job timeline, moderation queue, user management, audit log, settings and categories.
6. **Referral requests**: a member asks a job's poster for a referral with a short pitch and an optional resume link. The poster accepts, marks them as referred or declines. Both sides track requests under **Referrals**, with in-app and email notifications. Search can also filter to jobs with a referral available.

## Stack

| Layer | Technology |
| --- | --- |
| Web (`apps/web`) | React 19, Vite 7, TypeScript, MUI 7, React Router 7, TanStack Query 5, React Hook Form + Zod, Lucide, Day.js |
| API (`apps/api`) | Node.js, Express 5, TypeScript, Prisma 7 (`@prisma/adapter-pg`), PostgreSQL 16, Argon2id, Nodemailer, Pino |
| Shared (`packages/shared`) | Zod schemas, enums, DTO types and the share-message builder, used by both apps |
| Tooling | npm workspaces, ESLint 9, Prettier, Vitest, Supertest, Playwright, Docker Compose |

Redux Toolkit is deliberately not used. Server state lives in TanStack Query, form state in React Hook Form, and the remaining UI state is local. No global client state would justify adding it.

## Quick start (local development)

Prerequisites: Node.js ≥ 20.19 (developed on 24), Docker.

```bash
cp .env.example .env          # defaults work out of the box
npm run db:up                 # PostgreSQL (port 5442) + Mailpit (SMTP 1025, inbox http://localhost:8025)
npm install                   # also builds the shared package and generates the Prisma client
npm run db:migrate            # apply migrations to the dev database
npm run db:seed               # sample users, categories, jobs, reports
npm run dev                   # API on http://localhost:4000, web on http://localhost:5180
```

Open **http://localhost:5180**. Every email (verification, password reset) lands in Mailpit at **http://localhost:8025**.

### Sample accounts (password `ReferLoop2026!`)

| Email | Role |
| --- | --- |
| `admin@referloop.dev` | Administrator |
| `arjun@referloop.dev`, `sara@referloop.dev`, `daniel@referloop.dev`, `meera@referloop.dev` | Verified members |
| `neha@referloop.dev` | Unverified member (cannot post or edit) |
| `vikram@referloop.dev` | Suspended (cannot sign in) |

`npm run db:reset` drops the dev database, re-applies migrations and re-seeds it.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Shared package watcher + API (`tsx watch`) + Vite dev server with `/api` proxy |
| `npm run build` | Builds shared, API (`apps/api/dist`) and web (`apps/web/dist`) |
| `npm start` | Runs the built API. Set `SERVE_WEB=true` (the default in production) to also serve the web build |
| `npm run lint` / `npm run typecheck` | ESLint across the repo / `tsc` for every workspace |
| `npm test` | Unit and integration tests in every workspace (see Testing) |
| `npm run test:e2e` | Playwright end-to-end suite (desktop, phone and tablet) |

## Project layout

```
packages/shared/src     enums, Zod schemas (auth, job, admin), DTO types, share message, URL helpers
apps/api/prisma         schema.prisma, migrations, seed.ts
apps/api/src
  config/env.ts         validated environment (refuses unsafe production settings)
  middleware/           session loading + guards, CSRF, rate limits, error handler
  modules/auth          registration, verification, login, reset, sessions
  modules/jobs          search, create, collaborative edit (optimistic locking), status, history, reports
  modules/admin         dashboard, users, jobs, moderation, audit log, categories
  modules/settings      cached app settings + public config
  modules/notifications in-app notifications
  modules/referrals     referral requests: request, respond, withdraw, inboxes
apps/api/tests          Vitest + Supertest integration tests against a real PostgreSQL database
apps/web/src
  api/                  fetch client (CSRF, errors) and TanStack Query hooks
  components/           JobCard, StatusChip, ShareMenu, ConfirmDialog, SkillsInput, layout…
  features/             auth, jobs, home, profile, notifications, admin, misc pages
e2e/                    Playwright specs
docs/                   API reference and deployment guide
```

## How the core rules are enforced

- **Verification before modification.** `requireVerified` guards every job write: create, edit, close, reopen, confirm and report. Unverified users can sign in, browse and save jobs.
- **Collaborative editing without lost updates.** Each job has a `version`. `PATCH /jobs/:id` must send the version the editor started from, and the update runs `UPDATE … WHERE id = ? AND version = ?`. A stale version returns `409 VERSION_CONFLICT`. The UI then lets the editor reload the latest version or deliberately reapply their changes on top of it.
- **Audit trail.** Job changes, `job_edit_history` (changed fields with previous and new values, actor, reason, version), `job_status_history`, notifications and `audit_logs` are written in one database transaction. A failed update leaves no history behind. The application never updates or deletes history rows. An admin restore of earlier values is a new `REVERTED` entry.
- **The original creator stays recorded.** `createdById` is never modified. `lastEditedById` tracks the latest editor.
- **Closed is not deleted.** Closed jobs drop out of the default search (`status=active`) but stay reachable and filterable. Archiving (admin only) is a soft flag, and records referenced by history are never hard-deleted.
- **Deadlines are not closures.** A passed deadline or a listing older than the configured freshness window shows a notice. Any verified member can confirm the job is still open or close it.
- **Privacy.** Other members only see a user's name. Emails, roles and account details are never part of job, history, report or share payloads. The one exception is consented: sending a referral request shares the requester's email with that referrer only.
- **Referral requests stay honest.** One request per member per job, verified members only, active jobs only. Status changes follow a fixed path (`PENDING → ACCEPTED → REFERRED`, or `DECLINED`/`WITHDRAWN`) and are guarded against concurrent changes. Requests are capped at 15 per member per day, because each one emails another member.

## Security summary

- Argon2id password hashing (OWASP parameters), with automatic rehash on login.
- Server-managed sessions: a random 256-bit token in an `HttpOnly`, `SameSite=Lax` cookie (`Secure` in production). Only its SHA-256 hash is stored. Sessions slide, and are revoked on logout, password change or reset, suspension and role change.
- Signed double-submit CSRF token (`rl_csrf` cookie + `X-CSRF-Token` header) on every state-changing request, plus a strict CORS allow-list.
- Single-use, expiring verification (24 h) and reset (1 h) tokens, stored only as hashes.
- No account enumeration: registration, password reset and login return identical responses whether or not the email exists. Unknown emails still pay the Argon2 cost.
- Rate limits on authentication, registration, reset, token redemption, job writes and reports. Accounts lock for 15 minutes after 10 failed logins, and the owner is emailed.
- Zod validation on every input, a 100 kB body limit, and an external-URL allow-list (http/https only, no credentials, no bare IPs or `localhost`).
- Helmet security headers including a strict CSP. React escapes all user content, which is rendered as plain text.
- Admin authorisation happens on the server (`requireAdmin` on the whole `/admin` router). Admins cannot change their own role or status, and the last active admin cannot be demoted or suspended.

## Testing

| Suite | Location | Command | Covers |
| --- | --- | --- | --- |
| Shared unit | `packages/shared/src/*.test.ts` | `npm test -w @referloop/shared` | schemas, share message, WhatsApp encoding, formatting |
| API integration | `apps/api/tests` | `npm test -w @referloop/api` | auth flows, permissions, collaborative edits, concurrency, status, search, reports, admin, persistence |
| Web unit | `apps/web/src/**/*.test.tsx` | `npm test -w @referloop/web` | ShareMenu, JobCard permissions, redirect safety |
| End to end | `e2e/` | `npm run test:e2e` | register → verify by real email → post → share → edit by another member → close → report → admin resolves; phone and tablet layouts |

The API tests use the `referloop_test` database and the end-to-end tests use `referloop_e2e`. Both are created by `docker/postgres-init` and wiped by their test suites. Both require `npm run db:up`.

> If your Postgres volume was created before `referloop_e2e` was added to the init script, create it once with `docker compose exec db psql -U referloop -c "CREATE DATABASE referloop_e2e OWNER referloop;"`.

## External credentials

Production needs only:

- **PostgreSQL**: `DATABASE_URL`.
- **SMTP** (any transactional provider, e.g. SES, SendGrid, Postmark or Mailgun): `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`.
- **`SESSION_SECRET`**: at least 32 random characters.

The API refuses to start in production without SMTP, or with the `console` email transport, so email verification cannot be bypassed.

More: [API reference](docs/API.md) · [Deployment guide](docs/DEPLOYMENT.md)
