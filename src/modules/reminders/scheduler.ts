import cron, { type ScheduledTask } from 'node-cron';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { remindersService } from './reminders.service';

let task: ScheduledTask | undefined;

/**
 * In-process node-cron scheduler (trigger path ①).
 *
 * Enabled via REMINDER_CRON_ENABLED. On free hosts that idle the dyno this may
 * not fire — the external-scheduler endpoint (path ②) covers that case, and the
 * manual endpoint (path ③) covers demos. All three call the same service.
 */
export function startReminderScheduler(): void {
  if (!env.REMINDER_CRON_ENABLED) {
    logger.info('Reminder in-process scheduler disabled (REMINDER_CRON_ENABLED=false)');
    return;
  }
  if (!cron.validate(env.REMINDER_CRON)) {
    logger.error({ cron: env.REMINDER_CRON }, 'Invalid REMINDER_CRON expression; scheduler not started');
    return;
  }

  task = cron.schedule(env.REMINDER_CRON, () => {
    remindersService.run('node-cron').catch((err) => {
      logger.error({ err: (err as Error).message }, 'scheduled reminder run failed');
    });
  });

  logger.info({ cron: env.REMINDER_CRON }, 'Reminder scheduler started');
}

export function stopReminderScheduler(): void {
  task?.stop();
  task = undefined;
}
