# Changelog

All notable implementation milestones for the Meeting Intelligence Service.

## [1.0.0] — Initial submission

### Scaffolding & cross-cutting
- Project scaffold: TypeScript, Express, ESLint/Prettier, zod-validated env config, app/server split.
- `GET /health` liveness probe returning `{ "status": "UP" }`.
- Trace-id middleware (generate/propagate `x-trace-id`), pino structured request logging.
- Unified response envelope (`{ traceId, success, data | error }`) + `AppError` model.
- Centralized global error handler (AppError / Zod / Prisma / malformed JSON → envelope).
- `CORS(*)` enabled for public evaluation.

### Data layer
- Prisma schema: `User`, `Meeting`, `Analysis`, `ActionItem`, `Reminder` (incl. `recipient`),
  enums for status/source/reminder-status; JSONB for transcript and citations; ownership + indexes.
- Singleton Prisma client; seed script (demo user + sample meeting + overdue item).

### Features
- **Auth (FR1):** register/login/me, bcrypt hashing, JWT issuance + guard.
- **Meetings (FR2):** create/get/list with pagination, title search, and date-range filters;
  per-user ownership.
- **AI analysis (FR3/FR4):** Gemini provider with structured output; strict grounding prompt;
  `citationValidator` enforcing citations and pruning invented attendees; Analysis persistence and
  idempotent AI action-item sync.
- **Action items (FR5):** create, status update (PENDING/IN_PROGRESS/COMPLETED), list with
  status/assignee/meetingId filters.
- **Overdue detection (FR6):** shared `overdueWhere` query + `GET /api/action-items/overdue`.
- **Scheduled reminders (FR7):** single `reminderService.run()` with three triggers — node-cron,
  secret-guarded `GET /api/internal/cron/reminders`, and manual `POST /api/reminders/run`; reminder
  history with dedupe window.
- **External integration (FR8):** Resend email notifier behind a `Notifier` interface; assignee→
  email recipient resolution; reminder email matching the assignment's format.

### Non-functional & docs
- Zod validation middleware with field-level error details.
- OpenAPI document (zod-to-openapi); Swagger UI at `/docs`, raw spec at `/openapi.json`.
- `GET /api/evaluation` metadata endpoint.
- Vitest unit suites (39 tests) covering grounding, recipient resolution, overdue, envelope,
  validation, pagination, and JWT.
- Documentation: README, DECISIONS, AI_APPROACH, TESTING, CHECKLIST.

### Deployment / bonus
- Dockerfile (multi-stage) + `.dockerignore`.
- Render Blueprint (`render.yaml`) provisioning web service + free Postgres.
- GitHub Actions CI (typecheck, lint, test) and a scheduled external-cron workflow for reminders.
