# Changelog

A record of implementation milestones, issues hit, and changes made during development.

---

## [Milestone 1] — Project Scaffold

Set up the base project: TypeScript, Express, ESLint/Prettier, zod-validated env config, app/server split.

- `GET /health` returning `{ "status": "UP" }`
- Trace-id middleware — generates `x-trace-id` per request, attaches to logs and response headers
- Unified response envelope `{ traceId, success, data | error }` so every endpoint returns the same shape
- `AppError` model with stable error codes (`NOT_FOUND`, `UNAUTHORIZED`, etc.) mapping to HTTP statuses
- Centralized error handler — catches AppError, ZodError, Prisma errors, malformed JSON in one place
- `asyncHandler` wrapper — Express does not catch async errors natively; this forwards them to the error handler
- CORS `*` enabled for public evaluation access

---

## [Milestone 2] — Database Design

Designed the Prisma schema on Neon (free-tier PostgreSQL).

- Models: `User`, `Meeting`, `Analysis`, `ActionItem`, `Reminder`
- Transcript and citations stored as JSONB — variable nested structure, not relational
- `ActionItem` has four indexes covering the query patterns: status filter, assignee filter, meetingId filter, and the overdue detection query (`status + dueDate`)
- Seed script added: demo user + sample meeting + overdue action item so the evaluator can test without creating data from scratch

**Decision:** Used JSONB for transcripts instead of a separate `TranscriptSegment` table. A 100-line transcript would need 100 INSERT statements relationally. JSONB stores it in one row and reads it back in one query.

---

## [Milestone 3] — Authentication

- `POST /api/auth/register` — bcrypt password hashing, duplicate email returns `409 Conflict`
- `POST /api/auth/login` — verifies password, issues signed JWT
- `GET /api/auth/me` — returns current user from token
- `requireAuth` middleware — verifies Bearer token, attaches `req.user`, rejects with `401` on failure

---

## [Milestone 4] — Meeting Management

- Create meeting with transcript (JSONB), list with pagination + title search + date range filters, get by ID
- Ownership enforced at query level — users only see their own meetings
- `getOwned()` checks existence first (404), then ownership (403) — order matters for security

**Issue hit:** Listing meetings was fetching full transcripts for every row — expensive for large transcripts. Fixed by using `select` to fetch only the columns the list view needs, with `_count` for action item count.

---

## [Milestone 5] — AI Analysis

The most complex part of the project. Several iterations to get right.

**Initial approach:** Sent transcript as plain text and asked Gemini to return JSON. Problem — Gemini occasionally returned free-text explanations wrapped around the JSON, breaking `JSON.parse()`.

**Fix:** Switched to Gemini's structured output (`responseMimeType: application/json` + `responseSchema`). The schema is enforced at the API level — Gemini cannot return anything that does not match it.

**Second issue:** Even with structured output, Gemini invented timestamps that did not exist in the transcript and assigned tasks to people not in the meeting.

**Fix:** Built `citationValidator.ts` — programmatic layer 3 of hallucination prevention:
- Builds a `Set` of valid timestamps from the actual transcript
- Strips any citation whose timestamp is not in the Set
- Drops the entire insight if zero valid citations remain
- Nulls out assignees not matching any known speaker or participant email

**Final approach — three-layer defense:**
1. Prompt: strict system instruction, enumerated allowed timestamps
2. Schema: `responseSchema` enforces citations field on every insight
3. Code: `citationValidator` cross-checks everything programmatically

Analysis is re-runnable — re-analysis replaces old AI action items but never touches manually created ones. Done inside a `prisma.$transaction` so the delete + recreate is atomic.

---

## [Milestone 6] — Action Item Management

- Create action items manually or linked to a meeting
- `PATCH /api/action-items/:id/status` — updates only the status field; `updatedAt` auto-set by Prisma `@updatedAt`
- List with filters: status, assignee (case-insensitive), meetingId — all optional, combined dynamically
- `overdueWhere()` extracted as a shared exported function used by both `/overdue` endpoint and the reminder job — single source of truth so the two never drift apart

**Issue hit:** `/overdue` route was being shadowed by `/:id` dynamic route. Fixed by registering `/overdue` before `/:id` in the router — Express matches top to bottom.

---

## [Milestone 7] — Scheduled Reminders + Email Integration

**Initial approach:** Used only `node-cron` (in-process scheduler). Problem — Render free-tier dynos sleep after 15 minutes of inactivity, killing the in-process cron entirely.

**Fix:** Three-trigger architecture — all three call the same `remindersService.run()`:
1. `node-cron` — still runs for local/always-on environments
2. `GET /api/internal/cron/reminders` — secret-guarded HTTP endpoint; GitHub Actions hits it every 15 min, waking the dyno and running the job simultaneously
3. `POST /api/reminders/run` — JWT-authenticated manual trigger for demos

**Resend free-tier issue:** Resend free tier only reliably delivers to the account owner's verified email. Real participant emails get rejected without a verified domain.

**Fix:** Added `REMINDER_TO_OVERRIDE` env var — routes all reminder emails to one verified inbox for the demo. Documented as a known limitation.

**Recipient resolution:** Assignees from AI extraction are names like "Alice" — needed to map to `alice@example.com` from the participants list. `resolveRecipient()` tries three paths: override env var → assignee is already an email → name matches participant local-part.

**Dedupe:** Without a dedupe window, every 15-minute run would spam the same person repeatedly. Added `REMINDER_DEDUPE_HOURS=24` — items reminded within the last 24 hours are skipped. Checked at the DB query level (`take: 1` on recent SENT reminders) not in application code.

**Resilience:** `try/catch` is inside the `for` loop — one failed send never aborts the rest of the batch. Every attempt (success or failure) writes a `Reminder` row for the audit trail.

---

## [Milestone 8] — Validation, Docs, and OpenAPI

- Zod validation middleware validates `body`, `query`, and `params` before controllers run — replaces request data with clean parsed output
- `zod-to-openapi` generates the OpenAPI spec from the same Zod schemas — no duplication
- Swagger UI at `/docs`, raw spec at `/openapi.json`
- `GET /api/evaluation` returns candidate metadata, deployed URL, and feature list

**Issue hit:** Initial OpenAPI response schemas were all `z.any()` — Swagger showed no response shape. Fixed by writing proper typed schemas for every endpoint response.

---

## [Milestone 9] — Tests

45 unit tests across 8 files covering the logic that matters most:

- `citationValidator` — grounding enforcement, mixed valid/invalid citations, invented assignee detection
- `recipient` — name-to-email resolution, format fallbacks
- `overdue` — boundary cases, COMPLETED exclusion, null dueDate exclusion
- `response` — envelope shape, AppError mapping
- `validation` — schema rules, bad email, invalid enum, malformed date
- `pagination` — defaults, clamping, bad input fallback
- `auth` — JWT sign/verify round-trip, wrong secret rejection
- `reminders.service` — full orchestration: sends SENT, skips deduped, records FAILED, batch continues after one failure

**Issue hit:** Reminder service tests failing with `"default level:undefined must be included in custom levels"`. Root cause — env mock was missing `LOG_LEVEL: 'info'`. Fixed by adding it to the mock.

---

## [Milestone 10] — Deployment

- Render Blueprint (`render.yaml`) provisions web service + free Postgres automatically from the repo
- Dockerfile (multi-stage) for containerized deployment
- GitHub Actions CI — typecheck, lint, test on every push
- GitHub Actions cron — hits `/api/internal/cron/reminders` every 15 min to keep reminders running on the free-tier dyno

**Issue hit:** GitHub Actions cron was returning `401`. Root cause — `CRON_SECRET` in GitHub secrets did not match the auto-generated value Render set. Fixed by copying the exact value from Render's Environment tab into the GitHub repo secret.

---

## [Milestone 11] — Post-Build Improvements

Changes made after the initial build based on review against the assignment criteria:

- **Pagination on reminder history** — `GET /api/reminders/history` was hardcoded to `limit=50`. Changed to use `parsePagination` + `buildPageMeta` consistently with all other list endpoints
- **Rate limiting** — added `express-rate-limit`: `authLimiter` (20 req/5 min) on auth routes, `apiLimiter` (100 req/5 min) on API routes. Cron endpoint intentionally excluded — protected by `x-cron-secret` instead
- **OpenAPI response schemas** — replaced all `z.any()` with proper typed response schemas so Swagger shows real response shapes
- **`toJson` helper** — replaced repeated `as unknown as Prisma.InputJsonValue` double-casts with a single named helper in analysis and meetings services
- **Docs cleanup** — To support proper formatting and efficient readability.
