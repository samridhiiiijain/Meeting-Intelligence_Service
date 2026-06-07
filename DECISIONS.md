# Technical Decisions

## D1. Runtime & Framework — Express + TypeScript

**Choice:** Node.js with Express and TypeScript.

**Why chosen:** Express is minimal and universally understood, so a reviewer can follow a request
top-to-bottom without learning a framework. Writing the cross-cutting concerns by hand (unified
envelope, trace-id middleware, global error handler) is exactly what the assignment grades, and
Express keeps them explicit and visible. TypeScript adds compile-time safety and self-documenting
types, signalling code quality.

**Alternatives considered:**
- **NestJS** — *Pros:* opinionated structure, DI, built-in guards/pipes/filters, native Swagger.
  *Cons:* heavy boilerplate and a learning curve that is overkill for a 6–10h task; hides the very
  mechanics being evaluated.
- **Fastify** — *Pros:* faster, schema-first validation + Swagger built in. *Cons:* fewer reference
  examples; schema-first is less flexible for a custom response envelope.
- **Python + FastAPI** — *Pros:* auto OpenAPI, Pydantic, great for AI. *Cons:* changes ecosystem;
  no advantage that outweighs staying in one TypeScript codebase.

**Trade-offs:** Express gives no structure for free — I impose it via a consistent
`routes → controller → service` module layout and shared middleware. That discipline is manual,
but it keeps the dependency surface and cognitive load small.

---

## D2. Language — TypeScript (over plain JavaScript)

**Choice:** TypeScript in `strict` mode.

**Why chosen:** Static types catch errors before runtime, make refactors safe, and document the
shape of meetings/transcripts/analysis without extra prose. Combined with Zod (D10), one schema
yields both runtime validation and a static type.

**Alternatives considered:** **Plain JS** — *Pros:* zero build step. *Cons:* no type safety, more
runtime bugs, weaker editor support.

**Trade-offs:** Adds a build step (`tsc`) and `tsx` for dev. Worth it for correctness and clarity.

---

## D3. Database — PostgreSQL

**Choice:** PostgreSQL.

**Why chosen:** The domain is inherently relational — users own meetings, meetings have action
items, action items have reminders. Postgres enforces these with foreign keys and gives strong
querying for the filters and overdue detection. JSONB columns hold the variable-shaped transcript
and citations, so I get relational integrity *and* flexible nested data. Free managed Postgres
(Neon/Render) keeps deployment persistent.

**Alternatives considered:**
- **MongoDB** — *Pros:* transcripts/citations as nested documents feel natural; flexible schema.
  *Cons:* cross-collection filtering (action items by status/assignee/meeting) and relational
  integrity are weaker; overdue + joins are clumsier.
- **MySQL** — *Pros:* solid relational DB. *Cons:* JSON support and ecosystem fit (Prisma + Neon)
  are less ergonomic than Postgres.
- **SQLite** — *Pros:* zero provisioning, simplest local dev. *Cons:* most cloud hosts use
  ephemeral disks → data lost on redeploy; not production-minded.

**Trade-offs:** Requires provisioning a database (vs SQLite's file). Mitigated by Neon's free,
persistent, zero-config tier.

---

## D4. ORM — Prisma

**Choice:** Prisma.

**Why chosen:** Type-safe queries that line up with the TypeScript-first stack, a single
declarative `schema.prisma` that doubles as living documentation, first-class migrations, and a
clean enum/JSON story. It made the `Meeting → ActionItem → Reminder` relations and the reusable
`overdueWhere` query trivial and safe.

**Alternatives considered:**
- **Raw SQL (pg)** — *Pros:* full control, no abstraction. *Cons:* manual typing, hand-written
  migrations, more boilerplate and footguns.
- **TypeORM** — *Pros:* mature, decorator-based. *Cons:* heavier, historically rougher migrations
  and type ergonomics.
- **Drizzle** — *Pros:* lightweight, SQL-like, great types. *Cons:* younger ecosystem; Prisma's
  migrations + Studio are more turnkey for this scope.

**Trade-offs:** Prisma adds a generated client and a `generate` step. The DX, safety, and
documentation value clearly justify it.

---

## D5. Authentication — JWT

**Choice:** Stateless JWT (bearer tokens), bcrypt-hashed passwords.

**Why chosen:** A public, stateless REST API that strangers (evaluators) will call is the textbook
JWT case. No session store/infra, trivial horizontal scaling, and reviewers authenticate in two
clicks in Swagger via the `Authorization: Bearer` header.

**Alternatives considered:** **Session-based auth** — *Pros:* easy server-side revocation.
*Cons:* needs a session store (in-memory dies on restart → forces Redis); cookies plus `CORS(*)`
are awkward for evaluators hitting the deployed URL from a browser/Swagger.

**Trade-offs:** JWTs can't be revoked before expiry. Mitigated with short-lived tokens
(`JWT_EXPIRES_IN`). For this scope, revocation isn't required.

---

## D6. LLM Provider — Google Gemini

**Choice:** Gemini (e.g. `gemini-2.0-flash`) behind a provider-agnostic `LLMProvider` interface.

**Why chosen:** Generous free tier with no credit card, and — critically — **native structured
output** (`responseMimeType` + `responseSchema`). That lets me enforce the citation-bearing JSON
shape at the API level instead of parsing free text, directly supporting the grounding requirement
(15% of the grade). The `LLMProvider` abstraction means swapping vendors is a one-file change.

**Alternatives considered:**
- **OpenAI** — *Pros:* excellent `json_schema` structured outputs. *Cons:* paid credits required.
- **Anthropic Claude** — *Pros:* strong grounding/instruction following. *Cons:* paid credits.
- **Groq** — *Pros:* free and very fast. *Cons:* open models; grounding nuance slightly weaker.
- **OpenRouter** — *Pros:* one API for many models. *Cons:* adds a broker layer; still needs
  credits for good models.

**Trade-offs:** Free-tier rate limits and occasional schema strictness quirks. Mitigated by low
temperature, a strict prompt, and the programmatic citation validator (defense in depth).

---

## D7. Grounding & Citation Strategy — schema-enforced output + programmatic validation

**Choice:** Three-layer defense: (1) a strict prompt enumerating allowed timestamps and forbidding
invention; (2) provider structured output requiring `citations[]` on every item; (3) a
programmatic `citationValidator` that drops any insight whose citations don't exist in the
transcript and nulls invented assignees — returning a `grounding` report.

**Why chosen:** Prompting alone doesn't guarantee grounding; models still hallucinate. Validating
every citation against the actual transcript makes grounding a *code-enforced invariant*, not a
hope. The report quantifies what was removed, which is honest and demonstrable.

**Alternatives considered:**
- **Prompt-only ("please cite")** — *Pros:* simplest. *Cons:* no guarantee; loses points when the
  model invents content.
- **RAG / embeddings retrieval** — *Pros:* impressive for large corpora. *Cons:* massive
  over-engineering for a single short transcript.

**Trade-offs:** The validator may drop a legitimately-derived insight if the model cites a wrong
timestamp. That's the safe direction (no hallucinations shown), and is documented in AI_APPROACH.

---

## D8. External Integration — Resend (email)

**Choice:** Resend as the reminder channel, behind a `Notifier` interface.

**Why chosen:** Email is the most product-realistic medium for action-item reminders and matches
the assignment's example reminder format exactly. Resend has a clean SDK and a free tier. The
`Notifier` abstraction keeps it swappable, and it is *actively used* by the reminder workflow (a
hard requirement — configuring an SDK without using it does not count).

**Alternatives considered:**
- **Discord / Slack webhook** — *Pros:* dead simple (one URL). *Cons:* a chat ping is less
  "reminder-like"; Slack now gates webhooks behind app creation.
- **Telegram Bot** — *Pros:* free, reliable. *Cons:* bot + chat-id setup; less natural for a
  per-assignee reminder.
- **Notion / Google Calendar** — *Pros:* visible artifacts. *Cons:* Notion reads as "recording"
  more than "notifying"; Calendar needs OAuth/service-account setup that risks eating the time
  budget.
- **SendGrid** — *Pros:* mature email provider. *Cons:* heavier onboarding/sender verification
  than Resend.

**Trade-offs:** Resend's free tier without a verified domain reliably delivers only to the account
owner. Mitigated with `REMINDER_TO_OVERRIDE` to route all demo reminders to one verified inbox;
recipient resolution (assignee → participant email) is still implemented and tested. Documented as
a known limitation.

---

## D9. Scheduler — node-cron + secret external-cron endpoint + manual trigger

**Choice:** One `reminderService.run()` reachable by three triggers: in-process node-cron,
a secret-guarded `GET /api/internal/cron/reminders` for an external scheduler, and an authenticated
`POST /api/reminders/run` for demos.

**Why chosen:** node-cron is the simplest fit for this scale. But free hosts idle the dyno, so an
in-process timer alone is unreliable in production. The external-cron endpoint (driven by GitHub
Actions / cron-job.org) both **wakes the dyno and runs the job**, and the manual endpoint
guarantees the reminder is demonstrable on demand. One service, three entry points → robust and
demoable regardless of host behavior.

**Alternatives considered:**
- **In-process cron only** — *Pros:* simplest. *Cons:* silently stops firing on an idled free dyno.
- **Render Cron Job / managed scheduler** — *Pros:* reliable. *Cons:* not on the free plan.
- **BullMQ + Redis** — *Pros:* production-grade queue, retries. *Cons:* needs Redis; over-engineering
  here.

**Trade-offs:** Three triggers is slightly more surface area, but each is a thin wrapper over the
same well-tested service, and the dedupe window prevents double-sends across triggers.

---

## D10. Validation & Schemas — Zod (+ zod-to-openapi)

**Choice:** Zod for all request validation, surfaced through a `validate` middleware, and reused to
generate the OpenAPI document.

**Why chosen:** One Zod schema gives runtime validation, a static TypeScript type (`z.infer`), and
OpenAPI documentation — a single source of truth. Error messages are clear and map cleanly into the
`VALIDATION_ERROR` envelope with field-level `details`.

**Alternatives considered:**
- **express-validator** — *Pros:* mature. *Cons:* verbose, no type inference.
- **Joi** — *Pros:* battle-tested. *Cons:* separate from TS types; no inference.

**Trade-offs:** Coupling validation, types, and docs to one library. Acceptable — Zod is stable and
the consolidation is a net simplification.

---

## D11. Hosting — Render (+ Neon Postgres, Docker as a fallback)

**Choice:** Render web service with a Blueprint (`render.yaml`), free Postgres, Docker provided too.

**Why chosen:** Render offers a free long-running web process (needed so the scheduler can run) plus
free managed Postgres, with env vars and health checks in one Blueprint. A `Dockerfile` keeps the
app portable to any container host.

**Alternatives considered:**
- **Railway** — *Pros:* great DX. *Cons:* free credits are limited/time-bound.
- **Fly.io** — *Pros:* powerful, always-on options. *Cons:* more config (volumes, Dockerfile).
- **Vercel** — *Pros:* trivial deploys. *Cons:* serverless — no long-running process for cron;
  poor fit for the scheduler.

**Trade-offs:** Render's free dyno idles; addressed by the external-cron trigger (D9).

---

## D12. Logging — pino

**Choice:** pino structured JSON logging, with a per-request child logger bound to the trace id.

**Why chosen:** Fast, structured JSON that aggregators can parse, satisfying the structured-logging
requirement (timestamp, traceId, method, path, status, duration, error details). `pino-pretty`
gives readable local output.

**Alternatives considered:**
- **winston** — *Pros:* flexible, popular. *Cons:* heavier, slower, more config.
- **console.log** — *Pros:* zero deps. *Cons:* unstructured; fails the requirement.

**Trade-offs:** A logging dependency, but small and high-value.

---

## Cross-cutting design notes

- **Unified envelope + trace IDs:** every response is `{ traceId, success, data | error }`
  (except `/health` and `/api/evaluation`, which return their documented raw shapes). The trace id
  is generated or propagated from `x-trace-id`/`x-request-id`, echoed in the response header, and
  bound to every log line.
- **Centralized error handling:** all errors funnel through one handler that maps `AppError`,
  `ZodError`, Prisma errors, and malformed JSON into the envelope. The app never crashes on bad
  input.
- **Ownership/authorization:** meetings and action items are scoped by `userId`; cross-user access
  returns 403/404.
- **Project layout:** feature modules (`routes/controller/service/schemas`) with shared
  `middleware`, `lib`, and `utils` — easy to navigate and extend.
