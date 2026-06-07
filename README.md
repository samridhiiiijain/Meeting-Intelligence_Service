# Meeting Intelligence Service

## The Problem

After every meeting, three things consistently fall through the cracks — no one writes down what was decided, action items get forgotten, and there's no follow-up when deadlines are missed.

Most teams either rely on someone manually taking notes (unreliable) or use expensive SaaS tools that lock data behind proprietary systems.

## What This Solves

A backend service that takes a raw meeting transcript and does the heavy lifting automatically:

- **Extracts insights** — summary, decisions, follow-ups, and action items directly from what was said, with every insight citing the exact transcript segment it came from
- **Tracks action items** — who owns what, by when, and what the current status is
- **Sends reminders** — automatically emails assignees when their tasks are overdue, on a schedule

The key design principle: every AI-generated insight is **grounded** — it must cite a real timestamp from the transcript. Nothing is invented. If the AI can't back it up, it gets dropped.

**Live API:** https://meeting-intelligence-service-ce9t.onrender.com  
**Swagger UI:** https://meeting-intelligence-service-ce9t.onrender.com/docs
**Note:** The deployed instance uses a Gemini free-tier key which has per-minute rate limits. If the `/analyze` endpoint returns a 502, wait 30 seconds and retry.
---

## Stack

Node.js 20 + TypeScript · Express · PostgreSQL + Prisma · Google Gemini · Resend · Zod · JWT · Vitest · Render

---

## Features

- JWT authentication (register, login, protected routes)
- Meeting management with paginated, filterable list
- AI analysis with grounded, citation-backed insights — summary, decisions, follow-ups, action items
- Hallucination prevention via prompt constraints + structured output schema + programmatic citation validator
- Action item tracking with status updates and overdue detection
- Scheduled reminder emails via three triggers — in-process cron, external scheduler, manual endpoint
- Unified response envelope with trace IDs on every response
- Structured JSON logging with per-request trace ID correlation (pino)
- OpenAPI/Swagger docs auto-generated from Zod schemas
- Production-ready: health check, evaluation endpoint, Docker support, GitHub Actions CI/CD

---

## Project Structure

```
src/
  config/       env validation, constants
  lib/          prisma client, logger, llm/, notifier/
  middleware/   traceId, requestLogger, auth, validate, errorHandler
  modules/      auth, meetings, analysis, actionItems, reminders, health, evaluation
  utils/        response envelope, AppError, asyncHandler, pagination
  openapi/      OpenAPI document builder
  app.ts        Express app
  server.ts     bootstrap — listen + start scheduler
prisma/         schema.prisma, migrations/, seed.ts
tests/          Vitest unit tests
```

---

## Local Setup

**Prerequisites:** Node >= 20, PostgreSQL (local or [Neon](https://neon.tech) free tier)

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Fill in DATABASE_URL, JWT_SECRET, GEMINI_API_KEY, RESEND_API_KEY

# 3. Run database migrations
npx prisma migrate dev --name init

# 4. Seed demo data (optional)
npm run seed
# Creates demo@hintro.test / Password123 with a sample meeting

# 5. Start development server
npm run dev
# Server at http://localhost:8080  |  Swagger at http://localhost:8080/docs
```

Other scripts: `npm run build`, `npm start`, `npm test`, `npm run prisma:studio`

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values below.

**Required**
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — secret for signing JWTs (min 16 chars)

**For AI analysis**
- `GEMINI_API_KEY` — Google AI Studio API key
- `GEMINI_MODEL` — model name (default `gemini-2.0-flash`)

**For reminders**
- `RESEND_API_KEY` — Resend API key
- `CRON_SECRET` — shared secret for the `x-cron-secret` header
- `REMINDER_TO_OVERRIDE` — route all emails to one inbox (Resend free tier workaround)
- `REMINDER_CRON` — cron expression (default `*/15 * * * *`)
- `REMINDER_CRON_ENABLED` — set `false` in production (external scheduler handles it)
- `REMINDER_DEDUPE_HOURS` — re-remind window in hours (default `24`)

**Optional**
- `PORT` — HTTP port (default `8080`)
- `DEPLOYED_URL` — shown in `GET /api/evaluation`

---

## API Overview

All responses use a unified envelope:

```json
{ "traceId": "...", "success": true,  "data": { } }
{ "traceId": "...", "success": false, "error": { "code": "...", "message": "..." } }
```

```
POST   /api/auth/register              Register a new user
POST   /api/auth/login                 Login, returns JWT
GET    /api/auth/me                    Current user

POST   /api/meetings                   Create meeting with transcript
GET    /api/meetings                   List meetings (paginated, filterable)
GET    /api/meetings/:id               Get meeting by ID
POST   /api/meetings/:id/analyze       Run AI analysis with citations

POST   /api/action-items               Create action item
GET    /api/action-items               List with filters (status, assignee, meetingId)
PATCH  /api/action-items/:id/status    Update status
GET    /api/action-items/overdue       List overdue items

POST   /api/reminders/run              Manually trigger reminder job
GET    /api/internal/cron/reminders    External scheduler trigger (x-cron-secret header)

GET    /health                         Health check
GET    /api/evaluation                 Candidate and deployment metadata
```

Full interactive docs at `/docs`.

---

## Deployment

### Render Blueprint

1. Push repo to GitHub
2. In Render: **New → Blueprint** → select repo
3. `render.yaml` provisions a free web service + Postgres automatically
4. Add secrets in the Render dashboard: `GEMINI_API_KEY`, `RESEND_API_KEY`, `REMINDER_TO_OVERRIDE`, `DEPLOYED_URL`
5. Verify `/health` and `/docs` on the deployed URL

### Docker

```bash
docker build -t meeting-intelligence-service .
docker run -p 8080:8080 --env-file .env meeting-intelligence-service
```

### External Scheduler

Free Render dynos idle after 15 minutes, stopping the in-process cron. The included GitHub Actions workflow (`.github/workflows/reminders-cron.yml`) hits `GET /api/internal/cron/reminders` every 15 minutes — waking the dyno and running the reminder job. Set repo secrets `DEPLOYED_URL` and `CRON_SECRET`.

---

## Docs

- [DECISIONS.md](./DECISIONS.md) — 12 architecture decisions with alternatives and trade-offs
- [AI_APPROACH.md](./AI_APPROACH.md) — grounding and hallucination prevention strategy
- [TESTING.md](./TESTING.md) — test scenarios and edge cases
- [CHANGELOG.md](./CHANGELOG.md) — build milestones
- [CHECKLIST.md](./CHECKLIST.md) — assignment requirements checklist
