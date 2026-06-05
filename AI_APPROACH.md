# AI Approach

How the service turns a raw transcript into **grounded, citation-backed** insights, and how it
prevents hallucinations. Relevant code: `src/modules/analysis/` and `src/lib/llm/`.

## Goal

For `POST /api/meetings/:id/analyze`, generate a **summary**, **action items**, **decisions**, and
**follow-up suggestions** where every single item is supported by — and cites — a specific
transcript segment. Nothing may be invented (no fake attendees, tasks, decisions, or outcomes).

## Pipeline

```
transcript (stored) → prompt builder → LLM (structured JSON) → citation validator → persist → response
```

1. **Load & guard** (`analysis.service.ts`): fetch the user's meeting; reject if the transcript is
   empty.
2. **Prompt** (`prompt.ts`): a strict system instruction + a user prompt that presents the
   transcript as a numbered, timestamp-keyed list and lists the *allowed* timestamp values.
3. **Generate** (`lib/llm/gemini.ts`): Gemini returns JSON constrained by a `responseSchema`.
4. **Validate grounding** (`citationValidator.ts`): drop unsupported items, strip invalid
   citations, null invented assignees, and compute a `grounding` report.
5. **Persist & respond**: upsert the `Analysis`, rebuild AI-sourced action items, return the
   grounded result.

## Prompt design

The **system instruction** sets hard rules: use only what's in the transcript; never invent
attendees/items/decisions/dates/outcomes; every item must carry ≥1 citation that is an exact
transcript `timestamp`; set `assignee` to null if no owner is stated; return empty arrays rather
than padding; paraphrase faithfully without interpretation.

The **user prompt** renders each segment as
`#n [timestamp="00:10"] Speaker: text` and then explicitly passes the
`Allowed timestamp values for citations: [...]` array, so the model is anchored to real keys.
Temperature is low (0.2) to keep output deterministic and faithful.

## Structured output (citation strategy)

Rather than parsing free text, the Gemini call uses `responseMimeType: application/json` with a
`responseSchema` that **requires** a `citations` array (each `{ timestamp }`) on every summary
point, action item, decision, and follow-up. This makes the citation-bearing shape an API-level
guarantee. The persisted/returned shape mirrors the assignment example:

```json
{
  "summary":     [{ "text": "...", "citations": [{ "timestamp": "00:10" }] }],
  "actionItems": [{ "task": "...", "assignee": "Alice", "citations": [{ "timestamp": "00:20" }] }],
  "decisions":   [{ "text": "...", "citations": [{ "timestamp": "..." }] }],
  "followUps":   [{ "text": "...", "citations": [{ "timestamp": "..." }] }],
  "grounding":   { "totalItems": 4, "keptItems": 4, "droppedItems": 0, "removedCitations": 0, "flaggedAssignees": 0 }
}
```

## Hallucination prevention (defense in depth)

1. **Prompt constraints** — explicit "do not invent" rules + enumerated allowed timestamps.
2. **Schema enforcement** — the model *cannot* return an item without a `citations` array.
3. **Programmatic validation** (`validateGrounding`) — the authoritative layer:
   - Each citation's `timestamp` must exist in the source transcript; non-existent ones are
     **removed**.
   - Any item left with **zero valid citations is dropped** (unsupported → not shown).
   - An action-item `assignee` that is not a known speaker or participant (matched by name or
     email local-part, case-insensitive) is **nulled out** — preventing invented attendees.
   - A `grounding` report (`totalItems`, `keptItems`, `droppedItems`, `removedCitations`,
     `flaggedAssignees`) is returned for transparency.

This means grounding is enforced by **code**, not by trust in the model.

## Output validation

The provider parses the model's JSON (failing loudly with a `DEPENDENCY_ERROR` if it isn't valid
JSON), and `validateGrounding` normalizes/filters the structure before anything is persisted or
returned. AI-extracted action items are written to the `ActionItem` table with `source = AI` and
their citations; re-running analysis replaces previous AI items idempotently while preserving
manual ones.

## Provider abstraction

All of this sits behind the `LLMProvider` interface (`lib/llm/provider.ts`). Swapping Gemini for
OpenAI/Claude/Groq means implementing one method; the prompt, validator, and workflow are unchanged.
A `setLLMProvider()` seam allows injecting a fake provider in tests.

## Reminder recipient resolution (AI-adjacent)

Because AI-extracted action items carry a speaker *name* (e.g. "Alice"), the reminder workflow maps
the assignee to an email: an assignee that is already an email is used directly; otherwise it is
matched to a meeting participant by email local-part (`alice` → `alice@example.com`). If nothing
resolves, the reminder is skipped and a `FAILED` reminder row is recorded (no crash).

## Known limitations

- **Paraphrase vs. exact-span citations:** citations reference a segment by timestamp, not a
  character span; an insight synthesizing several segments cites each relevant timestamp.
- **Validator is conservative:** if the model cites the wrong timestamp for an otherwise valid
  insight, that insight is dropped. This errs toward *never showing unsupported content*.
- **Free-tier rate limits:** Gemini's free tier may rate-limit under load; surfaced as a
  `DEPENDENCY_ERROR` envelope rather than a crash.
- **Email deliverability:** Resend's free tier (no verified domain) reliably delivers only to the
  account owner; use `REMINDER_TO_OVERRIDE` for demos (see DECISIONS.md D8).
- **Language:** prompt/validation assume a single primary language transcript.
