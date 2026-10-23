# ReferLoop REST API

Base path: `/api/v1`. All bodies are JSON. Dates are ISO-8601 strings; date-only fields use `YYYY-MM-DD`.
Request and response types are defined in [`packages/shared/src`](../packages/shared/src) (Zod schemas and `types.ts`).

## Conventions

**Authentication.** Sign-in sets an `HttpOnly` session cookie (`rl_session`). Browsers send it automatically; API clients must keep cookies.

**CSRF.** Every `POST`, `PUT`, `PATCH` and `DELETE` must send header `X-CSRF-Token` equal to the `rl_csrf` cookie. The cookie is set on any API response; `GET /auth/csrf` returns it explicitly.

**Errors.** Every error uses one envelope:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Please correct the highlighted fields.", "fields": { "title": "Job title is required" } } }
```

| Status | Typical codes |
| --- | --- |
| 400 | `VALIDATION_ERROR` (with `fields`), `INVALID_TOKEN`, `INVALID_ID`, `NOT_REVERTIBLE`, `PAYLOAD_TOO_LARGE` |
| 401 | `UNAUTHENTICATED`, `INVALID_CREDENTIALS` |
| 403 | `FORBIDDEN`, `EMAIL_NOT_VERIFIED`, `ACCOUNT_SUSPENDED`, `CSRF_INVALID`, `REGISTRATION_CLOSED`, `SELF_MODIFICATION` |
| 404 | `NOT_FOUND` |
| 409 | `VERSION_CONFLICT` (with `details.currentVersion`), `ALREADY_CLOSED`, `ALREADY_ACTIVE`, `ALREADY_REPORTED`, `ALREADY_RESOLVED`, `LAST_ADMIN`, `NO_CHANGE` |
| 429 | `RATE_LIMITED` |
| 500 | `INTERNAL_ERROR` (no internal details are exposed) |

**Pagination.** List endpoints accept `page` (default 1) and `pageSize`, and return:

```json
{ "items": [], "page": 1, "pageSize": 12, "total": 0, "totalPages": 1 }
```

**Access levels** used below: *public* (guests allowed), *public\** (guests allowed only while public browsing is enabled), *member* (signed in), *verified* (signed in with a verified email), *admin*.

---

## System

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/health` | public | `{ "status": "ok" }` after a database round-trip |
| GET | `/config` | public | `PublicConfig`: browsing/registration policy, allowed email domains, active categories |

## Authentication — `/auth`

| Method | Path | Access | Body | Response |
| --- | --- | --- | --- | --- |
| GET | `/auth/csrf` | public | – | `{ csrfToken }` |
| POST | `/auth/register` | public | `name, email, password, confirmPassword, companyName?, jobTitle?, acceptTerms: true` | `202 { message }`, identical for new and existing emails; an existing owner is emailed instead |
| POST | `/auth/verify-email` | public | `{ token }` | `200 { message }`; tokens are single-use and expire after 24 h |
| POST | `/auth/resend-verification` | public | `{}` when signed in, otherwise `{ email }` | `202 { message }` (generic) |
| POST | `/auth/login` | public | `{ email, password }` | `200 { user: CurrentUser }` + session cookie |
| POST | `/auth/logout` | public | – | `204`; revokes the current session |
| POST | `/auth/logout-all` | member | – | `204`; revokes every session of the user |
| POST | `/auth/forgot-password` | public | `{ email }` | `202 { message }` (generic) |
| POST | `/auth/reset-password` | public | `{ token, password, confirmPassword }` | `200 { message }`; tokens are single-use, expire after 1 h, and the reset revokes all sessions |
| GET | `/auth/me` | member | – | `{ user: CurrentUser }` |

Passwords must be 10–128 characters and contain a letter and a number. Login is rate-limited per IP and email (failures only), and 10 consecutive failures lock the account for 15 minutes.

## Profile — `/users`

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/users/me` | member | Current user |
| PATCH | `/users/me` | member | `{ name, companyName?, jobTitle? }`. Role, status and email cannot be changed here |
| POST | `/users/me/password` | member | `{ currentPassword, newPassword, confirmPassword }`; signs out the user's other sessions |
| GET | `/users/me/sessions` | member | Active sessions (`current` marks this one) |
| GET | `/users/me/jobs?scope=posted\|edited` | member | Jobs the user posted, or other people's jobs the user edited |
| GET | `/users/me/saved-jobs` | member | Saved jobs, including closed ones (shown with their status) |

## Jobs — `/jobs`

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/jobs` | public* | Search the board (query parameters below) → `Paginated<JobSummary>` |
| GET | `/jobs/suggestions/skills?q=` | public* | Up to 15 skills already in use, most common first |
| GET | `/jobs/suggestions/companies?q=` | public* | Up to 10 company names |
| POST | `/jobs/duplicates` | verified | `{ title, companyName, excludeJobId? }` → similar non-archived jobs (trigram similarity) |
| POST | `/jobs` | verified | Create a job (`JobInput`). Optional header `Idempotency-Key` (8–100 chars `[A-Za-z0-9_-]`): repeating it returns the same job with `200` instead of `201` |
| GET | `/jobs/:idOrSlug` | public* | `{ job: JobDetail }`. Archived jobs return 404 to everyone except admins |
| PATCH | `/jobs/:id` | verified | Full `JobInput` + `version` (required) + optional `status`, `reason` → `{ job, changed }`. A stale `version` returns `409 VERSION_CONFLICT` |
| POST | `/jobs/:id/close` | verified | `{ reason? }`. Active → Closed; `409 ALREADY_CLOSED` if already closed |
| POST | `/jobs/:id/reopen` | verified | `{ reason? }`. Closed → Active |
| POST | `/jobs/:id/confirm-active` | verified | `{ reason? }`. Records that the role is still open and clears stale notices |
| GET | `/jobs/:idOrSlug/history` | verified | `{ edits: JobHistoryEntry[], statusChanges: JobStatusHistoryEntry[] }`, newest first |
| POST | `/jobs/:id/report` | verified | `{ reason, description? }` → `201`. One open report per member per job; 10 per hour |
| POST | `/jobs/:id/referral-requests` | verified | `{ message (30–2000), profileUrl? }` → `201 { referral }`. Ask the poster for a referral (see Referrals) |
| PUT | `/jobs/:id/save` | member | Save a job |
| DELETE | `/jobs/:id/save` | member | Unsave a job |

`JobDetail.viewerReferral` is `{ id, status }` of the caller's latest referral request for the job, or `null`.

### Search parameters (`GET /jobs`)

| Parameter | Example | Meaning |
| --- | --- | --- |
| `q` | `react pune` | Every word must match title, company, location, summary, description or a skill (case-insensitive) |
| `status` | `active` (default) · `closed` · `all` | Closed jobs are excluded by default |
| `company` | `northwind` | Company name contains |
| `category` | `engineering` | Category slug |
| `location` | `bengaluru` | Location contains |
| `skills` | `react,typescript` | The job lists **all** of these skills (required or preferred) |
| `workMode` | `REMOTE,HYBRID` | Any of `REMOTE`, `HYBRID`, `ONSITE` |
| `employmentType` | `FULL_TIME,CONTRACT` | Any of `FULL_TIME`, `PART_TIME`, `CONTRACT`, `INTERNSHIP`, `TEMPORARY` |
| `expMin`, `expMax` | `2`, `5` | The job's experience range overlaps this range (open-ended bounds match) |
| `postedWithin` | `1` · `7` · `30` · `90` | Days |
| `referral` | `true` | Only jobs marked "Referral available" |
| `sort` | `newest` (default) · `updated` · `title` · `company` | |
| `page`, `pageSize` | `1`, `12` | `pageSize` ≤ 50 |

Invalid `status`, `sort`, `postedWithin` or experience values fall back to their defaults instead of failing.

### Job input (`JobInput`)

Required: `title` (3–150), `companyName`, `workMode`, `employmentType`, `summary` (20–500), `description` (50–20 000), `requiredSkills` (1–25), `referralAvailable`, `posterCanRefer`.
`location` is required unless `workMode` is `REMOTE`.
Optional: `categoryId`, `department`, `experienceMin`/`experienceMax` (0–50, max ≥ min), `salaryMin`/`salaryMax` with `salaryCurrency` (ISO code, required when a salary is given), `numberOfOpenings`, `responsibilities`, `preferredSkills`, `eligibility`, `referralInstructions`, `applicationUrl`, `recruiterUrl`, `applicantNotes`, `applicationDeadline` (`YYYY-MM-DD`).
`posterCanRefer: true` requires `referralAvailable: true`. URLs must be public `http(s)` links without credentials. Empty strings are stored as `null`.

## Notifications — `/notifications`

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/notifications?unread=true` | member | Paginated list plus `unreadCount` |
| POST | `/notifications/:id/read` | member | Mark one as read (scoped to the caller) |
| POST | `/notifications/read-all` | member | Mark all as read |

Notifications are created when someone edits your job; when a job you posted or saved is closed, reopened or archived; when your report is reviewed; when a referral request is sent to you or updated; and on account events.

## Referrals — `/referrals`

A verified member can ask the poster of an **active** job for a referral when the poster marked `posterCanRefer: true`. The request goes to the job's creator.

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/referrals?box=received\|sent&status=&page=&pageSize=` | member | `ReferralList`: paginated `ReferralRequestItem`s plus `pendingReceived` (requests awaiting the caller's response) |
| POST | `/referrals/:id/respond` | verified, referrer only | `{ status: ACCEPTED \| REFERRED \| DECLINED, note? }` |
| POST | `/referrals/:id/withdraw` | requester only | Withdraw a `PENDING` or `ACCEPTED` request |

- **Statuses:** `PENDING → ACCEPTED → REFERRED`. `PENDING` can also go straight to `REFERRED`, and `PENDING`/`ACCEPTED` can go to `DECLINED` (referrer) or `WITHDRAWN` (requester). Any other transition returns `409 INVALID_TRANSITION`. A concurrent change returns `409 REFERRAL_CHANGED`.
- **Rules:** one request per member per job (`409 ALREADY_REQUESTED`), unless the earlier request was withdrawn. No requests on your own job (`400 OWN_JOB`), on jobs without a personal referral offer (`400 REFERRAL_NOT_OFFERED`), on closed jobs (`409 JOB_CLOSED`), or when the poster is suspended (`409 REFERRER_UNAVAILABLE`).
- **Privacy:** sending a request shares the requester's email with that referrer only (`requester.email`). It is `null` for everyone else. The referrer's email is never exposed.
- **Side effects:** each request and response creates an in-app notification and an email, and is written to the audit log (`REFERRAL_*` actions). Other members' requests return `404`.

## Administration — `/admin` (admin only)

Every route is authorised on the server. Guests receive `401` and members receive `403`.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/admin/dashboard` | Totals (users, verified, suspended, active/closed/archived jobs, pending reports) and the 8 most recently changed jobs |
| GET | `/admin/users?q=&role=&status=&verified=yes\|no` | Users with session and job counts |
| PATCH | `/admin/users/:id/status` | `{ status: ACTIVE\|SUSPENDED, reason? }`. Suspending revokes every session. Not allowed on yourself or on the last admin |
| PATCH | `/admin/users/:id/role` | `{ role: MEMBER\|ADMIN }`. Only verified, active users can be promoted. Revokes the user's sessions |
| POST | `/admin/users/:id/revoke-sessions` | Sign the user out everywhere |
| GET | `/admin/jobs?q=&status=all\|active\|closed&archived=include\|exclude\|only` | All jobs with open-report counts |
| PATCH | `/admin/jobs/:id/archive` | `{ reason }` (required). Hides the job from members; history is preserved |
| POST | `/admin/jobs/:id/restore` | `{ reason? }` |
| POST | `/admin/jobs/:id/revert` | `{ historyId, version, reason }`. Re-applies the *previous values* of an `UPDATED`/`REVERTED` history entry as a new audited `REVERTED` edit |
| GET | `/admin/reports?status=PENDING\|OPEN\|ESCALATED\|RESOLVED\|DISMISSED\|ALL` | Moderation queue (default `PENDING` = open + escalated) |
| PATCH | `/admin/reports/:id` | `{ action: RESOLVE\|DISMISS\|ESCALATE, resolutionNote, jobAction?: NONE\|CLOSE\|ARCHIVE }`. A note is required except when escalating. A job action applies only with `RESOLVE`, runs in the same transaction, and also resolves the job's other open reports |
| GET | `/admin/audit-logs?action=&targetType=&actorId=` | Security and administrative events |
| GET / PUT | `/admin/settings` | `AppSettings`: public browsing, registration, allowed email domains, freshness window (days), notification toggles |
| GET / POST | `/admin/categories` | List (with job counts) / create `{ name, isActive, sortOrder }` |
| PATCH | `/admin/categories/:id` | Update a category. Categories are deactivated, never deleted |

## Rate limits (per 15 min or per hour, ×`RATE_LIMIT_SCALE`)

| Scope | Limit |
| --- | --- |
| All API calls per IP | 1500 / 15 min |
| Auth endpoints per IP | 100 / 15 min |
| Failed logins per IP + email | 8 / 15 min |
| Registrations per IP | 10 / h |
| Password-reset requests per IP + email | 5 / h |
| Token redemptions per IP | 30 / h |
| Job creation per user | 30 / h |
| Job edits and status changes per user | 200 / h |
| Reports per user | 10 / h |
| Referral requests per user | 15 / 24 h |
| Referral responses and withdrawals per user | 100 / h |
