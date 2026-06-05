import type { AnalyzeInput } from '../../lib/llm/provider';

/**
 * System instruction enforcing strict grounding. The model is told, in no
 * uncertain terms, to extract only what is present and to cite every item by an
 * existing transcript timestamp. This is layer 1 of the hallucination defense
 * (layer 2 = response schema; layer 3 = programmatic citationValidator).
 */
export const SYSTEM_INSTRUCTION = `You are a meeting-analysis assistant for a meeting intelligence product.
Your ONLY source of truth is the transcript provided by the user. Follow these rules strictly:

1. Extract ONLY information explicitly present in the transcript.
2. NEVER invent attendees, action items, decisions, owners, dates, or outcomes.
3. Every item you output (summary point, action item, decision, follow-up) MUST include
   at least one citation, and each citation MUST be the exact "timestamp" of a transcript
   segment that supports the item.
4. Only use timestamp values that appear in the transcript. Do not fabricate timestamps.
5. For action items, set "assignee" to the speaker/person the transcript indicates is
   responsible. If no owner is stated, set "assignee" to null. Do not guess an owner.
6. If the transcript contains no decisions (or no follow-ups, etc.), return an empty array
   for that field. Do not pad the output.
7. Be concise and factual. Paraphrase faithfully; do not add interpretation.`;

/** Build the user prompt: a numbered, timestamp-keyed view of the transcript. */
export function buildUserPrompt(input: AnalyzeInput): string {
  const segments = input.transcript
    .map((s, i) => `#${i + 1} [timestamp="${s.timestamp}"] ${s.speaker}: ${s.text}`)
    .join('\n');

  const allowedTimestamps = input.transcript.map((s) => s.timestamp);

  return `Meeting title: ${input.title}
Known participants (emails): ${input.participants.join(', ') || '(none provided)'}

TRANSCRIPT (cite using the exact timestamp values shown):
${segments}

Allowed timestamp values for citations: ${JSON.stringify(allowedTimestamps)}

Produce: a summary, action items (with assignee + citations), decisions, and follow-up
suggestions. Remember: every item needs at least one citation referencing one of the
allowed timestamps above.`;
}
