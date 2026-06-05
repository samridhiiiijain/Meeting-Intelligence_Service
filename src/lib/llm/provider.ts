import type { TranscriptSegment } from '../../modules/meetings/meetings.schemas';

/** A citation always references a transcript segment by its timestamp label. */
export interface Citation {
  timestamp: string;
}

export interface SummaryPoint {
  text: string;
  citations: Citation[];
}

export interface DecisionPoint {
  text: string;
  citations: Citation[];
}

export interface FollowUpPoint {
  text: string;
  citations: Citation[];
}

export interface ActionItemPoint {
  task: string;
  assignee: string | null;
  citations: Citation[];
}

/** Raw, untrusted structure returned by an LLM provider before grounding checks. */
export interface RawAnalysis {
  summary: SummaryPoint[];
  actionItems: ActionItemPoint[];
  decisions: DecisionPoint[];
  followUps: FollowUpPoint[];
}

export interface AnalyzeInput {
  title: string;
  participants: string[];
  transcript: TranscriptSegment[];
}

/**
 * Provider-agnostic LLM contract. Swapping Gemini for OpenAI/Claude/etc. means
 * implementing this one interface — no changes to the analysis workflow.
 */
export interface LLMProvider {
  readonly model: string;
  analyzeTranscript(input: AnalyzeInput): Promise<RawAnalysis>;
}
