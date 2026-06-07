# Technical Decisions

## 1. Runtime & Framework — Express + TypeScript

**Choice:** Node.js + Express + TypeScript.

**Why chosen:** Express is a lightweight, well-understood framework that keeps the request lifecycle explicit. Cross-cutting concerns like unified response envelopes, trace IDs, and global error handling are written directly as middleware, which makes them visible and straightforward. A heavier framework would abstract those layers away through its own conventions.

**Alternatives considered:**
- NestJS — structured and feature-rich, but its decorator-based abstractions add overhead that isn't needed at this scale and obscures the middleware patterns being graded.
- FastAPI (Python) — well-suited for AI services, but mixing Python and TypeScript for a single service would add unnecessary complexity.

**Trade-off:** Express provides no enforced structure, so the `routes → controller → service` layout is maintained manually per module.

---

## 2. Language — TypeScript

**Choice:** TypeScript in strict mode.

**Why chosen:** The transcript and analysis data are complex nested objects. Static types catch shape mismatches at compile time, before they become runtime errors. Combined with Zod, one schema definition provides both runtime validation and a compile-time type — no duplication.

**Alternatives considered:**
- Plain JavaScript — eliminates the build step, but gives up type safety and editor support. The risk of passing malformed data to Prisma or the LLM provider isn't worth the simplicity.

**Trade-off:** Requires a build step (`tsc`) and `tsx` for local development. Minor overhead with clear payoff.

---

## 3. Database — PostgreSQL

**Choice:** PostgreSQL, hosted on Neon's free tier.

**Why chosen:** The data model is relational — users own meetings, meetings have action items, action items have reminders. PostgreSQL enforces these relationships with foreign keys and handles the filtering and overdue detection queries efficiently. Transcripts and citations are variable-length nested structures, so those are stored as JSONB, giving flexibility where the structure isn't fixed and relational integrity where it is.

**Alternatives considered:**
- MongoDB — flexible storage works well for transcripts, but filtering action items by status, assignee, and meeting ID across documents is more awkward than relational queries.
- SQLite — easy to set up locally, but most cloud hosts use temporary disk storage, so data is lost on redeploy.
- MySQL — capable, but Postgres has better JSON support and integrates more cleanly with Prisma and Neon.

**Trade-off:** Requires a hosted database instance. Neon's free tier is persistent and zero-config, so this is not a practical cost.

---

## 4. ORM — Prisma

**Choice:** Prisma.

**Why chosen:** Prisma generates type-safe query methods from the schema, so malformed queries are caught at compile time. The `schema.prisma` file serves as readable documentation of the data model. Migrations are declarative and version-controlled, and enum/JSONB support works cleanly out of the box.

**Alternatives considered:**
- Raw SQL — maximum control and no abstraction layer, but requires manual type definitions and hand-written migrations.

**Trade-off:** Adds a generated client and a `prisma generate` step to the build. Justified by the type safety and the schema-as-documentation benefit.

---

## 5. Authentication — JWT

**Choice:** Stateless JWT with bcrypt-hashed passwords.

**Why chosen:** JWT is well-suited to a stateless REST API with a public audience. No session store is required, it works naturally with `CORS(*)`, and can authenticate in Swagger by pasting the token into the `Authorization: Bearer` field.

**Alternatives considered:**
- Session-based auth — straightforward revocation, but requires a persistent session store. In-memory sessions disappear on restart; Redis adds a dependency that isn't otherwise needed.

**Trade-off:** Tokens cannot be revoked before they expire. Acceptable for this scope — tokens are short-lived and there is no sensitive data that would warrant immediate revocation.

---

## 6. LLM Provider — Google Gemini

**Choice:** Gemini (`gemini-2.5-flash`) behind a `LLMProvider` interface.

**Why chosen:** The free tier requires no credit card, which keeps the project runnable without cost. More importantly, Gemini supports native structured output via `responseSchema` — the exact JSON shape, including required citation fields, is enforced at the API level rather than parsed from free text. The provider interface means swapping to a different LLM is a single-file change.

**Alternatives considered:**
- OpenAI — excellent structured output support, but requires paid credits.
- Anthropic Claude — strong instruction-following, also requires paid credits.

**Trade-off:** The free tier has rate limits — 5 requests/min, 20 requests/day, 250K tokens/min. Mitigated by using low temperature, a strict prompt, and a programmatic citation validator as an additional safeguard.

---

## 7. Grounding & Citations — Three-layer validation

**Choice:** Prompt constraints + Gemini `responseSchema` + programmatic `citationValidator`.

**Why chosen:** Relying on the prompt alone is not sufficient — language models can still produce plausible-sounding but incorrect content even with clear instructions. To make grounding a verified property rather than a best-effort one, every citation is cross-checked against the actual transcript in code. A timestamp that doesn't exist in the source is dropped. An insight left with no valid citations is removed entirely. An assignee not found in the participant list is nulled out.

**Alternatives considered:**
- Prompt-only — the simplest approach, but provides no programmatic guarantee. A hallucinated timestamp would pass through silently.

**Trade-off:** The validator may discard a legitimately derived insight if the model cited an incorrect timestamp. Showing less is preferable to showing something that cannot be verified against the source.

---

## 8. External Integration — Resend (email)

**Choice:** Resend for email delivery, behind a `Notifier` interface.

**Why chosen:** Email is a natural fit for action-item reminders and matches the format described in the assignment. Resend has a straightforward SDK and a free tier. The `Notifier` abstraction keeps the reminder workflow decoupled from the specific provider — switching to a different channel is a matter of implementing the interface.

**Alternatives considered:**
- Slack/Discord webhook — easy to set up, but a chat notification is a less appropriate format for a task reminder, and Slack now requires app creation for incoming webhooks.
- Telegram Bot — works well technically, but requires per-user bot and chat ID configuration.

**Trade-off:** Resend's free tier without a verified sending domain only delivers reliably to the account owner's email. Handled via `REMINDER_TO_OVERRIDE` for the demo environment. Documented as a known limitation.

---

## 9. Scheduler — Three trigger paths, one service

**Choice:** `reminderService.run()` callable from three entry points: in-process `node-cron`, a secret-guarded HTTP endpoint, and a JWT-authenticated manual endpoint.

**Why chosen:** An in-process cron job is sufficient for local or always-on environments, but Render's free tier idles dynos after 15 minutes of inactivity, which stops the timer. The HTTP endpoint (called by GitHub Actions every 15 minutes) both wakes the dyno and runs the job in the same request. The manual endpoint allows the reminder flow to be demonstrated on demand without waiting for a scheduled run.

**Alternatives considered:**
- In-process cron only — works locally but silently stops on free-tier hosting when the dyno sleeps.
- Render Cron Job — a reliable managed option, but not available on the free plan.

**Trade-off:** Three entry points is more surface area than a single scheduler. Each is a thin wrapper over the same service function, and a dedupe window prevents double-sends when multiple triggers fire close together.

---

## 10. Validation — Zod + zod-to-openapi

**Choice:** Zod for all request validation, reused via `zod-to-openapi` to generate the OpenAPI spec.

**Why chosen:** A single Zod schema produces three outputs — runtime validation, a TypeScript type via `z.infer`, and an OpenAPI definition. This eliminates duplication between validation logic and API documentation. Validation errors surface as structured `VALIDATION_ERROR` responses with field-level details, consistent with the unified envelope.

**Alternatives considered:**
- express-validator — mature and widely used, but verbose and doesn't produce TypeScript types from schema definitions.

**Trade-off:** Validation, types, and documentation are coupled to a single library. Zod is stable and actively maintained, so this is an acceptable consolidation.

---

## 11. Hosting — Render

**Choice:** Render web service + Neon Postgres, with a Dockerfile provided for portability.

**Why chosen:** Render's free tier supports a persistent web process, which is required for the in-process scheduler to function. A `render.yaml` Blueprint provisions both the web service and Postgres in one step. The Dockerfile keeps the app deployable on any container platform if needed.

**Alternatives considered:**
- Railway — good developer experience, but free-tier credits are limited and time-bound.
- Vercel — serverless execution model doesn't support long-running processes, so the scheduler would not work.

**Trade-off:** Free dynos idle after 15 minutes of inactivity. Addressed by the GitHub Actions external cron trigger (D9).

---

## 12. Logging — pino

**Choice:** pino structured JSON logger, with a per-request child logger bound to the trace ID.

**Why chosen:** pino produces structured JSON output with low overhead, which satisfies the structured logging requirement — every log line includes timestamp, trace ID, method, path, status, duration, and error details where applicable. `pino-pretty` formats it readably in local development.

**Alternatives considered:**
- `console.log` — no dependencies, but unstructured output doesn't meet the logging requirement.

**Trade-off:** One additional dependency. Given the logging requirements, it's the right tool for the job.
