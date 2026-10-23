# Deploying ReferLoop

In production, ReferLoop runs as **one Node.js process**. It serves the API under `/api/v1` and the built React app on the same origin, so session cookies stay first-party and no cross-origin setup is needed.

## Requirements

- PostgreSQL 14 or newer. The first migration enables the `pg_trgm` extension, so the database user must be allowed to run `CREATE EXTENSION` once; managed services such as RDS, Cloud SQL and Azure Flexible Server allow it.
- An SMTP server or transactional email provider.
- HTTPS termination in front of the app (load balancer, ingress or reverse proxy).

## Environment

| Variable | Production value |
| --- | --- |
| `NODE_ENV` | `production` |
| `PORT` | e.g. `4000` |
| `DATABASE_URL` | `postgresql://user:pass@host:5432/referloop?schema=public&sslmode=require` |
| `APP_URL` | Public HTTPS URL, e.g. `https://referloop.example.com`. Used in emails and shared links |
| `CORS_ORIGINS` | Same as `APP_URL` (comma-separate any extra origins) |
| `SESSION_SECRET` | ≥ 32 random characters: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `SESSION_TTL_HOURS` | Default `168` (7 days, sliding) |
| `COOKIE_SECURE` | Leave unset (defaults to `true` in production) |
| `TRUST_PROXY` | Number of proxies in front of the app (usually `1`), so rate limits see real client IPs |
| `SERVE_WEB` | Leave unset (defaults to `true` in production) |
| `EMAIL_TRANSPORT` | `smtp` (required in production) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | From your email provider |
| `LOG_LEVEL` | `info` |

The server validates its configuration on start-up. In production it **refuses to start** when SMTP is missing, when `EMAIL_TRANSPORT` is not `smtp`, or when `SESSION_SECRET` looks like a placeholder.

## Option A: Docker image

```bash
docker build -t referloop:1.0.0 .
docker run -d --name referloop -p 4000:4000 --env-file production.env referloop:1.0.0
```

On start, the container runs `prisma migrate deploy` (which is idempotent) and then `node dist/index.js`. It also defines a `HEALTHCHECK` against `/api/v1/health`.

To try the production image locally with the bundled Postgres and Mailpit:

```bash
docker compose --profile app up --build     # http://localhost:4000, inbox at http://localhost:8025
docker compose --profile app exec app npx tsx prisma/seed.ts   # optional sample data
```

The `app` profile turns off `Secure` cookies because it serves plain HTTP on localhost. Never do this in a real deployment.

## Option B: Node.js directly

```bash
npm ci
npm run build                                   # shared + API + web
npm run prisma:deploy -w @referloop/api         # apply migrations
NODE_ENV=production node apps/api/dist/index.js # or use a process manager (systemd, pm2)
```

## Option C: web on Netlify, API elsewhere

Netlify serves static sites only, so it can host the React app but not the API or database. `netlify.toml` builds `apps/web` and proxies `/api/*` to the API, so the browser still sees a single origin and cookies stay first-party.

1. Deploy the API and PostgreSQL to a Node host (Render, Railway, Fly.io…) using Option A or B, with these settings:
   - `SERVE_WEB=false`
   - `APP_URL` and `CORS_ORIGINS` set to the **Netlify** URL, e.g. `https://referloop.netlify.app`
   - `TRUST_PROXY=2` (Netlify's proxy plus the host's load balancer)
2. In `netlify.toml`, replace `https://YOUR-API-HOST` with the API's origin.
3. Create the Netlify site from the repository. Build settings come from `netlify.toml`, so leave them empty in the UI.

Install with **npm** only. pnpm and Yarn ignore the `workspaces` field, skip the workspace packages' dependencies, and then fail to build `packages/shared` (`Cannot find module 'zod'`). Netlify picks the package manager from the lockfile, so never commit a `pnpm-lock.yaml` or `yarn.lock`.

## Release checklist

1. Back up the database.
2. Deploy the new image or build.
3. `prisma migrate deploy` runs automatically in the container; run it yourself for Option B.
4. Check `GET /api/v1/health`, then sign in and open the Admin Console dashboard.

## Operations

- **Scaling out.** Sessions are stored in PostgreSQL, so any number of instances can serve traffic. Rate-limit counters are in memory, per instance. If you run more than one instance, replace the memory store in `apps/api/src/middleware/rateLimit.ts` with a shared store such as `rate-limit-redis`.
- **Background cleanup.** Each instance deletes sessions and tokens that expired more than 7 days ago, once a day.
- **First administrator.** Register normally, verify the email, then promote the account once in SQL:
  `UPDATE users SET role = 'ADMIN' WHERE email = 'you@company.com';`
  After that, promote other admins from the Admin Console. Every promotion is audited.
- **Backups.** Everything lives in PostgreSQL: users, jobs, history, reports, sessions and audit logs. Point-in-time recovery is recommended.
- **Logs.** In production, structured JSON goes to stdout (Pino). Cookies, CSRF headers and password fields are redacted.
- **Search at scale.** Title, company and location use trigram GIN indexes. Description search is a sequential `ILIKE`, which is fine for tens of thousands of jobs; beyond that, add a `tsvector` column with a GIN index.
- **Policy pages.** `apps/web/src/features/misc/TermsPage.tsx` contains placeholder terms and privacy text. Replace it with your organisation's reviewed policy before launch.
