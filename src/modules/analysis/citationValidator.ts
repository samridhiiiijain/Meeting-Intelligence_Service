import type {
  ActionItemPoint,
  Citation,
  RawAnalysis,
} from '../../lib/llm/provider';
import type { TranscriptSegment } from '../meetings/meetings.schemas';

export interface GroundingReport {
  totalItems: number;
  keptItems: number;
  droppedItems: number;
  removedCitations: number;
  flaggedAssignees: number;
}

export interface GroundedAnalysis {
  summary: Array<{ text: string; citations: Citation[] }>;
  actionItems: ActionItemPoint[];
  decisions: Array<{ text: string; citations: Citation[] }>;
  followUps: Array<{ text: string; citations: Citation[] }>;
  grounding: GroundingReport;
}

/**
 * Programmatic grounding enforcement (defense layer 3).
 *
 * - Keeps only citations whose timestamp exists in the source transcript.
 * - Drops any insight left with zero valid citations (unsupported → removed).
 * - Nulls out action-item assignees that are not a known speaker/participant
 *   (prevents invented attendees) and counts them as flagged.
 *
 * Returns the cleaned analysis plus a report quantifying what was removed, which
 * is surfaced to the API caller for transparency.
 */
export function validateGrounding(
  raw: RawAnalysis,
  transcript: TranscriptSegment[],
  participants: string[],
): GroundedAnalysis {
  const validTimestamps = new Set(transcript.map((s) => s.timestamp));
  const knownPeople = buildKnownPeople(transcript, participants);

  const report: GroundingReport = {
    totalItems: 0,
    keptItems: 0,
    droppedItems: 0,
    removedCitations: 0,
    flaggedAssignees: 0,
  };

  const filterCitations = (citations: Citation[] | undefined): Citation[] => {
    const list = Array.isArray(citations) ? citations : [];
    const kept = list.filter((c) => c && validTimestamps.has(c.timestamp));
    report.removedCitations += list.length - kept.length;
    return kept;
  };

  const groundTextItems = <T extends { text: string; citations: Citation[] }>(items: T[] | undefined): T[] => {
    const out: T[] = [];
    for (const item of items ?? []) {
      report.totalItems += 1;
      const citations = filterCitations(item.citations);
      if (citations.length === 0) {
        report.droppedItems += 1;
        continue;
      }
      report.keptItems += 1;
      out.push({ ...item, citations });
    }
    return out;
  };

  const groundActionItems = (items: ActionItemPoint[] | undefined): ActionItemPoint[] => {
    const out: ActionItemPoint[] = [];
    for (const item of items ?? []) {
      report.totalItems += 1;
      const citations = filterCitations(item.citations);
      if (citations.length === 0) {
        report.droppedItems += 1;
        continue;
      }
      let assignee = normalizeAssignee(item.assignee);
      if (assignee && !knownPeople.has(assignee.toLowerCase())) {
        // Invented owner — keep the task but drop the unsupported attendee.
        assignee = null;
        report.flaggedAssignees += 1;
      }
      report.keptItems += 1;
      out.push({ task: item.task, assignee, citations });
    }
    return out;
  };

  return {
    summary: groundTextItems(raw.summary),
    actionItems: groundActionItems(raw.actionItems),
    decisions: groundTextItems(raw.decisions),
    followUps: groundTextItems(raw.followUps),
    grounding: report,
  };
}

/** Known people = transcript speakers + participant emails + their local-parts. */
function buildKnownPeople(transcript: TranscriptSegment[], participants: string[]): Set<string> {
  const set = new Set<string>();
  for (const s of transcript) {
    if (s.speaker) set.add(s.speaker.toLowerCase());
  }
  for (const email of participants) {
    const lower = email.toLowerCase();
    set.add(lower);
    const local = lower.split('@')[0];
    if (local) set.add(local);
  }
  return set;
}

function normalizeAssignee(assignee: string | null | undefined): string | null {
  if (typeof assignee !== 'string') return null;
  const trimmed = assignee.trim();
  return trimmed.length > 0 ? trimmed : null;
}
