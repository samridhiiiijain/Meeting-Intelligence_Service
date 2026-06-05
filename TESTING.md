# Testing

## Strategy

Tests focus on the **logic that matters and is deterministic** — grounding/citation validation,
recipient resolution, overdue detection, the response envelope/error model, validation schemas,
pagination, and JWT signing. These are pure or near-pure functions, so they're fast, reliable, and
don't require a live database or external API. External effects (Gemini, Resend, Prisma) sit behind
interfaces with injectable test seams (`setLLMProvider`, `setNotifier`), so they can be mocked in
future integration tests without touching the network.

Run: `npm test` (Vitest). Config in `vitest.config.ts` injects a minimal test env.

## Test suites (39 tests, all passing)

| File | What it verifies |
|---|---|
| `tests/citationValidator.test.ts` | Keeps valid citations; **drops insights with non-existent timestamps**; strips only the bad citations from mixed items; **nulls invented assignees**; accepts assignee matching a participant local-part; handles empty input. |
| `tests/recipient.test.ts` | Assignee-as-email passthrough; **name→participant email mapping**; null when unresolved; reminder message formatting matches the assignment example (`Reminder/Assigned To/Due Date`), with `Unassigned`/`N/A` fallbacks. |
| `tests/overdue.test.ts` | `overdueWhere` excludes `COMPLETED` and requires a past due date; defaults `now` to current time. |
| `tests/response.test.ts` | Success/error envelope builders; `AppError` code→HTTP-status mapping; operational flag + details. |
| `tests/validation.test.ts` | Meeting schema accepts valid payload; rejects bad email, missing title, empty transcript, malformed timestamp, non-ISO date; status enum; action-item rules; password length. |
| `tests/pagination.test.ts` | Defaults, skip computation, non-numeric fallback, clamping to min/max bounds. |
| `tests/auth.test.ts` | JWT sign/verify round-trip; verification fails under the wrong secret. |

## Edge cases considered

- **Grounding:** hallucinated timestamps, mixed valid/invalid citations, invented assignees,
  empty/missing arrays, assignee matched by name vs. email local-part.
- **Overdue boundaries:** completed items excluded; null due dates excluded; due date strictly in
  the past.
- **Input validation:** invalid emails, missing required fields, invalid status values, invalid/
  non-ISO dates, malformed JSON body, malformed timestamps.
- **Auth:** missing/malformed `Authorization` header, invalid/expired/wrong-secret tokens.
- **Pagination:** non-numeric, negative, and oversized inputs.
- **Reminders:** unresolved recipient → `FAILED` row, dedupe within window, one failed send not
  aborting the batch.

## Manual / smoke verification (no DB required)

Booting the app and hitting the platform routes confirms the cross-cutting layer:

- `GET /health` → `{ "status": "UP" }`
- `GET /api/evaluation` → candidate/integration/features metadata
- `GET /openapi.json` → 14 documented paths; Swagger UI at `/docs`
- `GET /api/nope` → `NOT_FOUND` envelope
- `POST /api/auth/register {"email":"bad"}` → `VALIDATION_ERROR` envelope with field details
- `GET /api/meetings` without a token → `UNAUTHORIZED` envelope
- every response carries an `x-trace-id` header and a `traceId` in the body

## Full end-to-end (with a database)

With `DATABASE_URL` set and `npx prisma migrate dev` applied:
1. register → login → use the token
2. create a meeting (assignment sample payload)
3. analyze → confirm every insight has valid citations and no invented assignees
4. filter action items by status/assignee/meetingId
5. create an item with a past due date → it appears in `/overdue`
6. `POST /api/reminders/run` → email sent + `Reminder` row recorded; `GET /api/internal/cron/reminders`
   with the correct `x-cron-secret` runs the same job; a wrong secret returns 401

## Limitations discovered

- Integration tests against a real Postgres/Resend/Gemini are not included (kept as a bonus); the
  injectable seams make them straightforward to add.
- The grounding validator is intentionally conservative (see AI_APPROACH "Known limitations").
