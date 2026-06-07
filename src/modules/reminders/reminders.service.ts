import { env } from '../../config/env';
import { getNotifier } from '../../lib/notifier';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { overdueWhere } from '../actionItems/actionItems.service';
import { buildReminderMessage, resolveRecipient } from './recipient';
import { buildPageMeta, parsePagination } from '../../utils/pagination';
import type { PageMeta } from '../../utils/pagination';

export interface ReminderRunResult {
  triggeredBy: string;  // which path triggered it
  scanned: number;    // total overdue items found
  sent: number;       // emails successfully sent
  failed: number;          // send attempts that threw an error
  skippedRecent: number;          /// items already reminded within dedupe window
  unresolved: number;    // items where no email could be found
}

export const remindersService = {
  // Core reminder workflow (single source of truth for all 3 trigger paths):
  // find overdue items not reminded within dedupe window, resolve recipient,
  // send via Notifier (Resend), record a Reminder row (SENT/FAILED).
  // Never throws on a single failure — one bad item cannot abort the batch.
  async run(triggeredBy: string): Promise<ReminderRunResult> {
    //  Setup dedupe cutoff + logger
    const now = new Date();
    const dedupeCutoff = new Date(now.getTime() - env.REMINDER_DEDUPE_HOURS * 3600_000);
    const log = logger.child({ job: 'reminders', triggeredBy });

    // fetch all overdue items not yet recently reminded
    const overdue = await prisma.actionItem.findMany({
      where: overdueWhere(now),
      include: {
        meeting: { select: { participants: true } },
        reminders: {
          where: { status: 'SENT', sentAt: { gte: dedupeCutoff } },
          select: { id: true },
          take: 1,
        },
      },
    });

    const result: ReminderRunResult = {    //Initialize the result counters
      triggeredBy,
      scanned: overdue.length,
      sent: 0,
      failed: 0,
      skippedRecent: 0,
      unresolved: 0,
    };

    const notifier = getNotifier();   //Get the notifier (lazy singleton)

    for (const item of overdue) {    //Process each overdue item in a loop with checks
      if (item.reminders.length > 0) {
        result.skippedRecent += 1;   // Dedupe: was it recently reminded?
        continue;
      }

      const recipient = resolveRecipient({    //Resolve recipient email
        assignee: item.assignee,
        meetingParticipants: item.meeting?.participants ?? [],
      });

      if (!recipient) {
        result.unresolved += 1;
        await this.record(item.id, '', 'FAILED', 'No recipient email could be resolved for assignee');
        continue;
      }

      const message = buildReminderMessage(recipient, {   //Build the reminder message
        task: item.task,
        assignee: item.assignee,
        dueDate: item.dueDate,
      });

      try {    //Send and record
        await notifier.send(message);
        await this.record(item.id, recipient, 'SENT', message.text);
        result.sent += 1;
      } catch (err) {
        result.failed += 1;
        await this.record(item.id, recipient, 'FAILED', message.text, (err as Error).message);
        log.warn({ actionItemId: item.id, err: (err as Error).message }, 'reminder send failed');
      }
    }

    log.info(result, 'reminder run complete');   // Log and return
    return result;
  },

  async record(    //the audit trail
    actionItemId: string,
    recipient: string,
    status: 'SENT' | 'FAILED',
    message: string,
    error?: string,
  ) {
    await prisma.reminder.create({
      data: { actionItemId, recipient, status, message, error: error ?? null },
    });
  },

  /** Paginated reminder history for the authenticated user's action items. */
  async history(
    userId: string,
    query: { page?: number; limit?: number } = {},
  ): Promise<{ items: unknown[]; meta: PageMeta }> {
    const pagination = parsePagination(query);
    const where = { actionItem: { userId } };

    const [items, total] = await Promise.all([
      prisma.reminder.findMany({
        where,
        orderBy: { sentAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
        include: { actionItem: { select: { id: true, task: true, assignee: true } } },
      }),
      prisma.reminder.count({ where }),
    ]);

    return { items, meta: buildPageMeta(total, pagination) };
  },
};
