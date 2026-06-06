import { env } from '../../config/env';
import type { ReminderMessage } from '../../lib/notifier';

// Intentionally lenient — matches anything that looks like an email address.
// Strict RFC validation happens at the API boundary (auth.schemas.ts); here we
// just need to distinguish "Alice" (name) from "alice@example.com" (address).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ResolvableItem {
  assignee: string | null;
  meetingParticipants: string[];
}

/**
 * Resolve the email address a reminder should be sent to.
 *
 * Priority:
 *  1. REMINDER_TO_OVERRIDE (demo: route everything to one verified inbox).
 *  2. assignee is already an email.
 *  3. assignee name matches a participant email (by local-part, case-insensitive),
 *     e.g. "Alice" → "alice@example.com".
 * Returns null when no address can be resolved (caller records a FAILED reminder).
 */
export function resolveRecipient(item: ResolvableItem): string | null {
  if (env.REMINDER_TO_OVERRIDE && EMAIL_RE.test(env.REMINDER_TO_OVERRIDE)) {
    return env.REMINDER_TO_OVERRIDE;
  }

  const assignee = item.assignee?.trim();
  if (!assignee) return null;

  if (EMAIL_RE.test(assignee)) return assignee;

  const needle = assignee.toLowerCase();
  for (const email of item.meetingParticipants) {
    const local = email.toLowerCase().split('@')[0];
    if (local === needle) return email;
  }
  return null;
}

export interface ReminderContext {
  task: string;
  assignee: string | null;
  dueDate: Date | null;
}

/** Build the reminder email, mirroring the assignment's example format. */
export function buildReminderMessage(to: string, ctx: ReminderContext): ReminderMessage {
  const due = ctx.dueDate ? ctx.dueDate.toISOString().slice(0, 10) : 'N/A';
  const assignee = ctx.assignee ?? 'Unassigned';

  const text = `Reminder: ${ctx.task}\nAssigned To: ${assignee}\nDue Date: ${due}`;
  const html = `<div style="font-family:sans-serif">
  <h2>⏰ Action Item Reminder</h2>
  <p><strong>Reminder:</strong> ${escapeHtml(ctx.task)}</p>
  <p><strong>Assigned To:</strong> ${escapeHtml(assignee)}</p>
  <p><strong>Due Date:</strong> ${due}</p>
  <hr/>
  <p style="color:#888">Sent by Hintro Meeting Intelligence Service</p>
</div>`;

  return { to, subject: `Reminder: ${ctx.task}`, text, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
