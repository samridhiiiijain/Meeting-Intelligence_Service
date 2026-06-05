import { describe, it, expect } from 'vitest';
import { validateGrounding } from '../src/modules/analysis/citationValidator';
import type { RawAnalysis } from '../src/lib/llm/provider';
import type { TranscriptSegment } from '../src/modules/meetings/meetings.schemas';

const transcript: TranscriptSegment[] = [
  { timestamp: '00:10', speaker: 'John', text: 'We should launch next Friday.' },
  { timestamp: '00:20', speaker: 'Alice', text: 'I will prepare release notes.' },
];
const participants = ['alice@example.com', 'bob@example.com'];

describe('validateGrounding', () => {
  it('keeps insights with valid citations', () => {
    const raw: RawAnalysis = {
      summary: [{ text: 'Team plans to launch next Friday.', citations: [{ timestamp: '00:10' }] }],
      actionItems: [
        { task: 'Prepare release notes', assignee: 'Alice', citations: [{ timestamp: '00:20' }] },
      ],
      decisions: [],
      followUps: [],
    };
    const result = validateGrounding(raw, transcript, participants);
    expect(result.summary).toHaveLength(1);
    expect(result.actionItems).toHaveLength(1);
    expect(result.actionItems[0].assignee).toBe('Alice');
    expect(result.grounding.droppedItems).toBe(0);
  });

  it('drops insights whose citations do not exist in the transcript', () => {
    const raw: RawAnalysis = {
      summary: [
        { text: 'Real point', citations: [{ timestamp: '00:10' }] },
        { text: 'Hallucinated point', citations: [{ timestamp: '99:99' }] },
      ],
      actionItems: [],
      decisions: [],
      followUps: [],
    };
    const result = validateGrounding(raw, transcript, participants);
    expect(result.summary).toHaveLength(1);
    expect(result.summary[0].text).toBe('Real point');
    expect(result.grounding.droppedItems).toBe(1);
    expect(result.grounding.removedCitations).toBe(1);
  });

  it('strips only the invalid citations when an item has a mix', () => {
    const raw: RawAnalysis = {
      summary: [{ text: 'Mixed', citations: [{ timestamp: '00:10' }, { timestamp: 'bogus' }] }],
      actionItems: [],
      decisions: [],
      followUps: [],
    };
    const result = validateGrounding(raw, transcript, participants);
    expect(result.summary[0].citations).toEqual([{ timestamp: '00:10' }]);
    expect(result.grounding.removedCitations).toBe(1);
    expect(result.grounding.keptItems).toBe(1);
  });

  it('nulls out an invented assignee (not a known speaker/participant)', () => {
    const raw: RawAnalysis = {
      summary: [],
      actionItems: [
        { task: 'Do thing', assignee: 'Mallory', citations: [{ timestamp: '00:10' }] },
      ],
      decisions: [],
      followUps: [],
    };
    const result = validateGrounding(raw, transcript, participants);
    expect(result.actionItems).toHaveLength(1);
    expect(result.actionItems[0].assignee).toBeNull();
    expect(result.grounding.flaggedAssignees).toBe(1);
  });

  it('accepts assignee matching a participant local-part', () => {
    const raw: RawAnalysis = {
      summary: [],
      actionItems: [{ task: 'X', assignee: 'bob', citations: [{ timestamp: '00:10' }] }],
      decisions: [],
      followUps: [],
    };
    const result = validateGrounding(raw, transcript, participants);
    expect(result.actionItems[0].assignee).toBe('bob');
    expect(result.grounding.flaggedAssignees).toBe(0);
  });

  it('handles empty / missing arrays defensively', () => {
    const raw = { summary: [], actionItems: [], decisions: [], followUps: [] } as RawAnalysis;
    const result = validateGrounding(raw, transcript, participants);
    expect(result.grounding.totalItems).toBe(0);
    expect(result.summary).toEqual([]);
  });
});
