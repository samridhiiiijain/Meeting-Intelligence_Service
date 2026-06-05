import type { Request, Response } from 'express';
import { CRON_SECRET_HEADER } from '../../config/constants';
import { env } from '../../config/env';
import { AppError } from '../../utils/errors';
import { ok } from '../../utils/response';
import { remindersService } from './reminders.service';

export const remindersController = {
  /** Manual, authenticated trigger for demos. */
  async run(req: Request, res: Response) {
    const result = await remindersService.run(`manual:${req.user!.email}`);
    ok(res, result);
  },

  /** Recent reminder history for the authenticated user. */
  async history(req: Request, res: Response) {
    const items = await remindersService.history(req.user!.id);
    ok(res, items);
  },

  /**
   * Secret-guarded endpoint for an external scheduler (cron-job.org / GitHub
   * Actions). Wakes the idled host AND runs the job. Auth is a shared secret in
   * the `x-cron-secret` header (constant-time-ish compare).
   */
  async cron(req: Request, res: Response) {
    if (!env.CRON_SECRET) {
      throw AppError.dependency('CRON_SECRET is not configured');
    }
    const provided = req.header(CRON_SECRET_HEADER) || '';
    if (provided !== env.CRON_SECRET) {
      throw AppError.unauthorized('Invalid or missing cron secret');
    }
    const result = await remindersService.run('external-cron');
    ok(res, result);
  },
};
