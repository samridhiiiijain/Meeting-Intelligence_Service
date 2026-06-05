# Meeting Intelligence Service

An AI-powered meeting intelligence backend. It stores meetings and transcripts, generates
**grounded, citation-backed** insights (summary, action items, decisions, follow-ups), tracks
action items, detects overdue items, and sends **real email reminders** via Resend on a schedule.

Built for the Hintro Backend/Fullstack Engineering Internship assignment.

- **Stack:** Node + Express + TypeScript · PostgreSQL + Prisma · JWT auth · Google Gemini
  (structured output) · Zod validation · node-cron · Resend (email) · Swagger/OpenAPI · Vitest
- **Live URL:** _set after deploy_ → see `GET /api/evaluation`
- **API docs (Swagger):** `<deployed-url>/docs` · raw spec at `<deployed-url>/openapi.json`

> See **[DECISIONS.md](./DECISIONS.md)** for why each technology was chosen (with alternatives
> and trade-offs), **[AI_APPROACH.md](./AI_APPROACH.md)** for the grounding/citation strategy,
> **[TESTING.md](./TESTING.md)**, **[CHANGELOG.md](./CHANGELOG.md)**, and **[CHECKLIST.md](./CHECKLIST.md)**.

---

## Features

| Requirement | Where |
|---|---|
| JWT Authentication | `POST /api/auth/register`, `/login`, `GET /api/auth/me` |
| Meeting management (+ pagination & filters) | `POST/GET /api/meetings`, `GET /api/meetings/:id` |
| AI analysis with citations | `POST /api/meetings/:id/analyze` |
| Grounding / hallucination prevention | `src/modules/analysis/citationValidator.ts` |
| Action item management (+ filters) | `POST/GET /api/action-items`, `PATCH /api/action-items/:id/status` |
| Overdue detection | `GET /api/action-items/overdue` |
| Scheduled reminder job (3 triggers) | node-cron · `GET /api/internal/cron/reminders` · `POST /api/reminders/run` |
| Real third-party integration | Resend email (`src/lib/notifier/resend.ts`) |
| Unified response envelope + trace IDs | `src/utils/response.ts`, `src/middleware/traceId.ts` |
| Structured logging | `src/middleware/requestLogger.ts` (pino) |
| Global error handling + validation | `src/middleware/errorHandler.ts`, `validate.ts` (zod) |
| Health & evaluation endpoints | `GET /health`, `GET /api/evaluation` |

---

## Project structure

```
src/
  config/      env (zod-validated), constants
  lib/         prisma, logger, llm/ (Gemini), notifier/ (Resend)
  middleware/  traceId, requestLogger, auth, validate, errorHandler, notFound
  modules/     auth, meetings, analysis, actionItems, reminders, health, evaluation
  utils/       response envelope, AppError, asyncHandler, pagination
  openapi/     OpenAPI document builder
  app.ts       Express assembly (testable)
  server.ts    bootstrap (listen + scheduler)
prisma/        schema.prisma, seed.ts
tests/         Vitest unit tests
```

---

## Environment variables

Copy `.env.example` → `.env` and fill in:

| Variable | Required | Description |
|---|---|---|
| `PORT` | no | HTTP port (default 8080) |
| `NODE_ENV` | no | `development` \| `test` \| `production` |
| `CORS_ORIGIN` | no | `*` (default) or comma-separated origins |
| `DATABASE_URL` | **yes** | PostgreSQL connection string (e.g. Neon) |
| `JWT_SECRET` | **yes** | ≥16 chars, used to sign JWTs |
| `JWT_EXPIRES_IN` | no | e.g. `1d` (default) |
| `GEMINI_API_KEY` | for analysis | Google AI Studio key (free tier) |
| `GEMINI_MODEL` | no | default `gemini-2.0-flash` |
| `RESEND_API_KEY` | for reminders | Resend API key |
| `RESEND_FROM` | no | sender; default `onboarding@resend.dev` |
| `REMINDER_TO_OVERRIDE` | no | route all reminder emails to one inbox (demo; see AI_APPROACH) |
| `REMINDER_CRON` | no | cron expr (default `*/15 * * * *`) |
| `REMINDER_CRON_ENABLED` | no | enable in-process cron (default true; set false in prod) |
| `REMINDER_DEDUPE_HOURS` | no | don't re-remind within this window (default 24) |
| `CRON_SECRET` | for ext. cron | shared secret for `x-cron-secret` header |
| `CANDIDATE_NAME` / `CANDIDATE_EMAIL` / `REPOSITORY_URL` / `DEPLOYED_URL` | no | `GET /api/evaluation` metadata |

---

## Local development

Prerequisites: Node ≥ 20, a PostgreSQL database (local Docker or a free Neon instance).

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env        # then edit values

# 3. Create the schema
npx prisma migrate dev --name init   # or: npx prisma db push

# 4. (optional) seed a demo user + sample meeting
npm run seed                # demo@hintro.test / Password123

# 5. Run
npm run dev                 # http://localhost:8080  (docs at /docs)
```

Other scripts: `npm run build`, `npm start`, `npm test`, `npm run lint`, `npm run prisma:studio`.

---

## API usage examples

```bash
BASE=http://localhost:8080

# Register (returns { data: { user, token } })
curl -X POST $BASE/api/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"me@example.com","password":"Password123","name":"Me"}'

TOKEN=... # copy data.token from the response

# Create a meeting
curl -X POST $BASE/api/meetings -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{
    "title":"Sprint Planning",
    "participants":["alice@example.com","bob@example.com"],
    "meetingDate":"2026-05-20T10:00:00Z",
    "transcript":[
      {"timestamp":"00:10","speaker":"John","text":"We should launch next Friday."},
      {"timestamp":"00:20","speaker":"Alice","text":"I will prepare release notes."}
    ]
  }'

# Analyze it (grounded insights with citations)
curl -X POST $BASE/api/meetings/<MEETING_ID>/analyze -H "Authorization: Bearer $TOKEN"

# Action items: filter, update status, overdue
curl "$BASE/api/action-items?status=PENDING&assignee=Alice" -H "Authorization: Bearer $TOKEN"
curl -X PATCH $BASE/api/action-items/<ID>/status -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"status":"IN_PROGRESS"}'
curl $BASE/api/action-items/overdue -H "Authorization: Bearer $TOKEN"

# Trigger reminders manually (sends email + records history)
curl -X POST $BASE/api/reminders/run -H "Authorization: Bearer $TOKEN"
```

Every response uses the unified envelope:

```json
{ "traceId": "…", "success": true, "data": { } }
{ "traceId": "…", "success": false, "error": { "code": "VALIDATION_ERROR", "message": "…" } }
```

---

## Deployment

### Option A — Render Blueprint (recommended)
1. Push this repo to GitHub.
2. In Render: **New → Blueprint**, select the repo. `render.yaml` provisions a free web service
   + free Postgres, runs `prisma migrate deploy`, and sets `JWT_SECRET`/`CRON_SECRET` automatically.
3. Add the secret env vars in the dashboard: `GEMINI_API_KEY`, `RESEND_API_KEY`,
   `REMINDER_TO_OVERRIDE` (optional), and the `CANDIDATE_*` / `REPOSITORY_URL` / `DEPLOYED_URL`.
4. Verify `https://<app>.onrender.com/health` and `/docs`.

### Option B — Docker
```bash
docker build -t meeting-intelligence-service .
docker run -p 8080:8080 --env-file .env meeting-intelligence-service
```

### Scheduler in production
The free Render dyno may idle, so the in-process cron is disabled in `render.yaml`
(`REMINDER_CRON_ENABLED=false`). Instead, the included GitHub Action
(`.github/workflows/reminders-cron.yml`) hits `GET /api/internal/cron/reminders` every 15 minutes
with the `x-cron-secret` header — waking the dyno and running the job. Set repo secrets
`DEPLOYED_URL` and `CRON_SECRET`. (Any external scheduler such as cron-job.org works too.)

---

## Notes on free-tier email
Resend's free tier (without a verified domain) reliably delivers only to the account owner's
address. For demos, set `REMINDER_TO_OVERRIDE` to that verified inbox to route all reminders
there. See [AI_APPROACH.md](./AI_APPROACH.md) and [DECISIONS.md](./DECISIONS.md) (D8).
