import { describe, it, expect } from 'vitest';
import { createMeetingSchema } from '../src/modules/meetings/meetings.schemas';
import { createActionItemSchema, updateStatusSchema } from '../src/modules/actionItems/actionItems.schemas';
import { registerSchema } from '../src/modules/auth/auth.schemas';

describe('createMeetingSchema', () => {
  const valid = {
    title: 'Sprint Planning',
    participants: ['alice@example.com'],
    meetingDate: '2026-05-20T10:00:00Z',
    transcript: [{ timestamp: '00:10', speaker: 'John', text: 'We should launch next Friday.' }],
  };

  it('accepts a valid payload', () => {
    expect(createMeetingSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an invalid participant email', () => {
    const r = createMeetingSchema.safeParse({ ...valid, participants: ['not-an-email'] });
    expect(r.success).toBe(false);
  });

  it('rejects a missing title', () => {
    const { title: _omit, ...rest } = valid;
    expect(createMeetingSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects an empty transcript', () => {
    expect(createMeetingSchema.safeParse({ ...valid, transcript: [] }).success).toBe(false);
  });

  it('rejects a malformed timestamp', () => {
    const r = createMeetingSchema.safeParse({
      ...valid,
      transcript: [{ timestamp: 'noon', speaker: 'A', text: 'x' }],
    });
    expect(r.success).toBe(false);
  });

  it('rejects a non-ISO meetingDate', () => {
    expect(createMeetingSchema.safeParse({ ...valid, meetingDate: '2026/05/20' }).success).toBe(false);
  });
});

describe('updateStatusSchema', () => {
  it('accepts valid statuses', () => {
    expect(updateStatusSchema.safeParse({ status: 'IN_PROGRESS' }).success).toBe(true);
  });
  it('rejects invalid statuses', () => {
    expect(updateStatusSchema.safeParse({ status: 'DONE' }).success).toBe(false);
  });
});

describe('createActionItemSchema', () => {
  it('requires a task', () => {
    expect(createActionItemSchema.safeParse({}).success).toBe(false);
  });
  it('rejects a non-UUID meetingId', () => {
    expect(createActionItemSchema.safeParse({ task: 'x', meetingId: 'abc' }).success).toBe(false);
  });
  it('rejects an invalid dueDate', () => {
    expect(createActionItemSchema.safeParse({ task: 'x', dueDate: 'tomorrow' }).success).toBe(false);
  });
});

describe('registerSchema', () => {
  it('enforces a minimum password length', () => {
    const r = registerSchema.safeParse({ email: 'a@b.com', password: 'short', name: 'A' });
    expect(r.success).toBe(false);
  });
});
