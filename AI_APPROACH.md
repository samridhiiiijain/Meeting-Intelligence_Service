# AI Approach

How `POST /api/meetings/:id/analyze` turns a raw transcript into grounded, citation-backed insights — and how hallucinations are prevented.

---

## Goal

Generate a **summary**, **action items**, **decisions**, and **follow-ups** where every single item cites the exact transcript segment it came from. Nothing can be invented — no fake attendees, tasks, decisions, or outcomes.

---

## Pipeline

```
Transcript
    │
    ▼
Prompt Builder         — formats transcript as numbered, timestamp-keyed list
    │                    passes allowed timestamps explicitly to the model
    ▼
Gemini API             — returns structured JSON (not free text)
    │                    responseSchema enforces citations on every item
    ▼
Citation Validator     — checks every citation against real transcript timestamps
    │                    drops items with zero valid citations
    │                    nulls out invented assignees
    ▼
Persist & Respond      — saves Analysis + ActionItems to DB
                         returns grounded result with a grounding report
```

---

## Step 1 — Prompt Design

The prompt has two parts:

**System instruction** — sets hard rules for the model:
- Use only what is explicitly stated in the transcript
- Never invent attendees, decisions, dates, or outcomes
- Every item must carry at least one citation (`timestamp`)
- Set `assignee` to null if no owner is stated
- Return empty arrays rather than padding with guesses

**User prompt** — presents the transcript like this:
```
#1 [timestamp="00:05"] Alice: Let's discuss the Q4 roadmap.
#2 [timestamp="00:32"] Bob: I'll handle the database migration by Friday.

Allowed citation timestamps: ["00:05", "00:32", ...]
```

Passing the allowed timestamps explicitly anchors the model to real values. Temperature is set to `0.2` for deterministic, faithful output.

---

## Step 2 — Structured Output

Instead of asking Gemini for free text and parsing it, the API call uses `responseSchema` — a JSON Schema that Gemini must match at the API level.

Every item in the schema **requires** a `citations` array:

```json
{
  "summary":     [{ "text": "...", "citations": [{ "timestamp": "00:05" }] }],
  "actionItems": [{ "task": "...", "assignee": "Bob", "dueDate": "...", "citations": [{ "timestamp": "00:32" }] }],
  "decisions":   [{ "text": "...", "citations": [{ "timestamp": "..." }] }],
  "followUps":   [{ "text": "...", "citations": [{ "timestamp": "..." }] }]
}
```

This means the model **cannot return an insight without at least one citation** — enforced by the API, not by trust.

---

## Step 3 — Citation Validator (Hallucination Prevention)

Even with a strict prompt and schema, the model might cite a timestamp that doesn't exist. This is handled programmatically in `citationValidator.ts`:

| Check | Action |
|---|---|
| Citation timestamp not in source transcript | Remove that citation |
| Item has zero valid citations remaining | Drop the entire item |
| Assignee not a known speaker or participant | Set assignee to null |

After validation, the response includes a `grounding` report:

```json
"grounding": {
  "totalItems": 6,
  "keptItems": 6,
  "droppedItems": 0,
  "removedCitations": 0,
  "flaggedAssignees": 0
}
```

This makes grounding **transparent** — the evaluator can see exactly how many items (if any) were dropped.

> Grounding is enforced by code, not by trust in the model.

---

## Defense in Depth Summary

Three independent layers — all three must pass for an insight to appear in the response:

```
Layer 1 — Prompt      "Do not invent. Cite real timestamps only."
Layer 2 — Schema      Model cannot return items without citations (API-level)
Layer 3 — Validator   Code checks every citation against source transcript
```

---

## Provider Abstraction

The entire pipeline sits behind an `LLMProvider` interface (`src/lib/llm/provider.ts`). Swapping Gemini for OpenAI or any other model means implementing one method — the prompt, validator, and workflow stay unchanged.

---

## Known Limitations

- **Timestamp-level citations** — citations reference a segment by timestamp, not a character span. An insight that synthesises multiple segments cites each relevant timestamp.
- **Conservative validator** — if the model cites the wrong timestamp for an otherwise valid insight, the item is dropped. This errs toward never showing unsupported content.
- **Free-tier rate limits** — Gemini's free tier may rate-limit under load. Surfaced as a `DEPENDENCY_ERROR` in the response envelope, not a server crash.
- **Email deliverability** — Resend's free tier delivers only to the account owner's address. Use `REMINDER_TO_OVERRIDE` for demos (see DECISIONS.md D8).
