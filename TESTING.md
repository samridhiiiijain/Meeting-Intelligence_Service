# Testing

## Strategy

These tests focus on logic that is deterministic and doesn't require a live database or external API — grounding/citation validation, recipient resolution, overdue detection, response envelope, validation schemas, pagination, and JWT signing. External effects (Gemini, Resend, Prisma) sit behind interfaces with injectable test seams so they can be mocked in future integration tests without touching the network.

Run all tests: `npm test` (Vitest, 45 tests across 8 files)

---

## Test Suites

**`citationValidator.test.ts`**
- Keeps citations that reference real transcript timestamps
- Drops entire insights when all citations are invalid
- Strips only the bad citations from mixed valid/invalid items
- Nulls out assignees that don't match any known speaker or participant
- Handles empty input gracefully

**`recipient.test.ts`**
- Passes through an assignee that is already a valid email
- Maps an assignee name to a participant email by local-part match (e.g. "Alice" → "alice@example.com")
- Returns null when no address can be resolved
- Formats reminder email with correct subject, body, and fallbacks (`Unassigned`, `N/A`)

**`overdue.test.ts`**
- Excludes `COMPLETED` items from the overdue query
- Excludes items with no due date
- Only includes items with a due date strictly in the past

**`response.test.ts`**
- `ok()` always produces `success: true` with correct envelope shape
- `fail()` always produces `success: false` with error code and message
- `AppError` maps to the correct HTTP status and error code

**`validation.test.ts`**
- Meeting schema accepts a valid payload
- Rejects bad email, missing title, empty transcript, malformed timestamp, non-ISO date
- Status enum rejects unknown values
- Action item rules and password length enforced

**`pagination.test.ts`**
- Defaults to page 1, limit 10
- Computes skip correctly
- Falls back to defaults on non-numeric input
- Clamps to min/max bounds

**`auth.test.ts`**
- JWT sign/verify round-trip succeeds
- Verification fails with the wrong secret

**`reminders.service.test.ts`**
- Sends reminder and records `SENT` for a resolvable overdue item
- Skips items already reminded within the dedup window
- Records `FAILED` and increments `unresolved` when recipient can't be resolved
- Records `FAILED` and increments `failed` when notifier throws
- One failed send does not abort the rest of the batch
- Returns correct `scanned`, `sent`, `skipped`, `failed` counts

---

## Edge Cases Covered

- Hallucinated timestamps, mixed valid/invalid citations, invented assignees
- Completed items and null due dates excluded from overdue
- Invalid emails, missing required fields, invalid status values, malformed dates
- Non-numeric, negative, and oversized pagination inputs
- Unresolved reminder recipient records a `FAILED` row without crashing the batch

---

## Manual Smoke Tests

Without a database:

```
GET  /health                              → { "status": "UP" }
GET  /api/evaluation                      → candidate metadata
GET  /docs                                → Swagger UI
GET  /api/nope                            → NOT_FOUND envelope
POST /api/auth/register  { email:"bad" }  → VALIDATION_ERROR with field details
GET  /api/meetings  (no token)            → UNAUTHORIZED envelope
```

Every response includes an `x-trace-id` header and `traceId` in the body.

---

## End-to-End (with database)

1. Register → login → copy JWT
2. Create a meeting with a transcript
3. Analyze → verify every insight has valid citations, no invented assignees
4. Filter action items by status / assignee / meetingId
5. Create an item with a past due date → appears in `/overdue`
6. `POST /api/reminders/run` → email sent, `Reminder` row recorded
7. `GET /api/internal/cron/reminders` with correct secret → runs job; wrong secret → 401

---

## Limitations Discovered

- Gemini 2.5 Flash free tier is limited to 5 requests/min and 20 requests/day. If `/analyze` returns a 502, wait 30 seconds and retry. The daily limit resets every 24 hours.
- Gemini sometimes paraphrases rather than directly quoting a segment — the citation timestamp is valid, but the link is looser than ideal.
- Assignee-to-email resolution breaks if two participants share the same first name or the transcript name doesn't match the email prefix.
- The in-process `node-cron` timer stops when the Render free-tier dyno idles. Mitigated by the GitHub Actions external trigger, but a short gap can exist.
- Resend free tier without a verified domain only delivers to the account owner's email. `REMINDER_TO_OVERRIDE` handles this for the demo.
- Re-analysis replaces AI-generated action items entirely — any manual status updates to those items are lost on re-run. Manual items are never affected.
- Integration tests are not included. The service boundaries (Prisma, Notifier, LLMProvider) are injectable, so they can be added without touching the network.
