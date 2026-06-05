# Meeting Intelligence Service

An AI-powered backend that stores meetings and transcripts, generates **grounded citation-backed insights**, manages action items, and sends **automated email reminders**.

**Live API:** https://meeting-intelligence-service-ce9t.onrender.com  
**Swagger UI:** https://meeting-intelligence-service-ce9t.onrender.com/docs

---

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 + TypeScript |
| Framework | Express |
| Database | PostgreSQL (Neon) + Prisma ORM |
| AI | Google Gemini (structured output) |
| Email | Resend |
| Validation | Zod + zod-to-openapi |
| Auth | JWT (HS256) |
| Testing | Vitest |
| Deployment | Render (Blueprint) |

---

## Features

- JWT authentication (register, login, protected routes)
- Meeting management with paginated, filterable list
- AI analysis with grounded, citation-backed insights (summary, decisions, follow-ups, action items)
- Hallucination prevention via prompt constraints + structured output schema + programmatic citation validator
- Action item tracking with status updates and overdue detection
- Scheduled reminder emails via three trigger paths (in-process cron, external scheduler, manual)
- Unified response envelope with trace IDs on every response
- Structured JSON logging (pino)
- OpenAPI/Swagger documentation auto-generated from Zod schemas

---

## Project Structure

```
src/
  config/       env validation (Zod), constants
  lib/          prisma client, logger, llm/, notifier/
  middleware/   traceId, requestLogger, auth, validate, errorHandler
  modules/      auth, meetings, analysis, actionItems, reminders, health, evaluation
  utils/        response envelope, AppError, asyncHandler, pagination
  openapi/      OpenAPI document builder
  app.ts        Express app (exported for testing)
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
# Edit .env with your DATABASE_URL, JWT_SECRET, GEMINI_API_KEY, RESEND_API_KEY

# 3. Run database migrations
npx prisma migrate dev --name init

# 4. Seed demo data (optional)
npm run seed
# Creates demo@hintro.test / Password123 with a sample meeting

# 5. Start development server
npm run dev
# Server at http://localhost:8080
# Swagger UI at http://localhost:8080/docs
```

**Other scripts:**

```bash
npm run build        # compile TypeScript
npm start            # run compiled output
npm test             # run Vitest unit tests
npm run prisma:studio  # open Prisma Studio
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the required values.

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `JWT_SECRET` | yes | Secret for signing JWTs (min 16 chars) |
| `GEMINI_API_KEY` | for analysis | Google AI Studio API key |
| `RESEND_API_KEY` | for reminders | Resend API key |
| `CRON_SECRET` | for ext. scheduler | Shared secret for `x-cron-secret` header |
| `REMINDER_TO_OVERRIDE` | no | Route all reminder emails to one inbox (free tier workaround) |
| `PORT` | no | HTTP port (default 8080) |
| `GEMINI_MODEL` | no | default `gemini-2.0-flash` |
| `REMINDER_CRON` | no | Cron expression (default `*/15 * * * *`) |
| `REMINDER_CRON_ENABLED` | no | Enable in-process cron (default `true`, set `false` in prod) |
| `REMINDER_DEDUPE_HOURS` | no | Re-remind window in hours (default `24`) |
| `DEPLOYED_URL` | no | Shown in `GET /api/evaluation` |

---

## API Overview

All responses use a unified envelope:

```json
{ "traceId": "...", "success": true, "data": { } }
{ "traceId": "...", "success": false, "error": { "code": "...", "message": "..." } }
```

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Register a new user |
| POST | `/api/auth/login` | — | Login, returns JWT |
| GET | `/api/auth/me` | JWT | Current user |
| POST | `/api/meetings` | JWT | Create meeting with transcript |
| GET | `/api/meetings` | JWT | List meetings (paginated, filterable) |
| GET | `/api/meetings/:id` | JWT | Get meeting by ID |
| POST | `/api/meetings/:id/analyze` | JWT | Run AI analysis with citations |
| POST | `/api/action-items` | JWT | Create action item |
| GET | `/api/action-items` | JWT | List with filters (status, assignee, meetingId) |
| PATCH | `/api/action-items/:id/status` | JWT | Update status |
| GET | `/api/action-items/overdue` | JWT | List overdue items |
| POST | `/api/reminders/run` | JWT | Manually trigger reminder job |
| GET | `/api/internal/cron/reminders` | Secret | External scheduler trigger |
| GET | `/health` | — | Health check |
| GET | `/api/evaluation` | — | Candidate and deployment metadata |

Full interactive docs at `/docs`.

---

## Deployment

### Render Blueprint (one-click)

1. Push repo to GitHub
2. In Render: **New → Blueprint** → select repo
3. `render.yaml` provisions a free web service + Postgres automatically
4. Add secrets in the Render dashboard: `GEMINI_API_KEY`, `RESEND_API_KEY`, `REMINDER_TO_OVERRIDE`, `CANDIDATE_*`, `DEPLOYED_URL`
5. Verify `/health` and `/docs` on the deployed URL

### Docker

```bash
docker build -t meeting-intelligence-service .
docker run -p 8080:8080 --env-file .env meeting-intelligence-service
```

### External Scheduler (production)

Free Render dynos idle after 15 minutes of inactivity, stopping the in-process cron. The included GitHub Actions workflow (`.github/workflows/reminders-cron.yml`) hits `GET /api/internal/cron/reminders` every 15 minutes — waking the dyno and running the reminder job.

Set two repository secrets: `DEPLOYED_URL` and `CRON_SECRET`.

---

## Documentation

| File | Contents |
|---|---|
| [DECISIONS.md](./DECISIONS.md) | 12 architecture decisions with alternatives and trade-offs |
| [AI_APPROACH.md](./AI_APPROACH.md) | Grounding and hallucination prevention strategy |
| [TESTING.md](./TESTING.md) | Test scenarios and edge cases |
| [CHANGELOG.md](./CHANGELOG.md) | Build milestones |
| [CHECKLIST.md](./CHECKLIST.md) | Assignment requirements checklist |
