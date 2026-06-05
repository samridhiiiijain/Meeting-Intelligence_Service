import { describe, it, expect } from 'vitest';
import { buildReminderMessage, resolveRecipient } from '../src/modules/reminders/recipient';

describe('resolveRecipient', () => {
  it('uses an assignee that is already an email', () => {
    expect(
      resolveRecipient({ assignee: 'carol@example.com', meetingParticipants: [] }),
    ).toBe('carol@example.com');
  });

  it('maps an assignee name to a participant email by local-part', () => {
    expect(
      resolveRecipient({
        assignee: 'Alice',
        meetingParticipants: ['alice@example.com', 'bob@example.com'],
      }),
    ).toBe('alice@example.com');
  });

  it('returns null when no email can be resolved', () => {
    expect(
      resolveRecipient({ assignee: 'Zoe', meetingParticipants: ['alice@example.com'] }),
    ).toBeNull();
  });

  it('returns null for a null assignee', () => {
    expect(resolveRecipient({ assignee: null, meetingParticipants: [] })).toBeNull();
  });
});

describe('buildReminderMessage', () => {
  it('formats subject + body matching the assignment example', () => {
    const msg = buildReminderMessage('alice@example.com', {
      task: 'Prepare release notes',
      assignee: 'Alice',
      dueDate: new Date('2026-05-25T00:00:00Z'),
    });
    expect(msg.to).toBe('alice@example.com');
    expect(msg.subject).toBe('Reminder: Prepare release notes');
    expect(msg.text).toContain('Reminder: Prepare release notes');
    expect(msg.text).toContain('Assigned To: Alice');
    expect(msg.text).toContain('Due Date: 2026-05-25');
  });

  it('falls back to Unassigned / N/A when fields are missing', () => {
    const msg = buildReminderMessage('x@example.com', {
      task: 'Task',
      assignee: null,
      dueDate: null,
    });
    expect(msg.text).toContain('Assigned To: Unassigned');
    expect(msg.text).toContain('Due Date: N/A');
  });
});
