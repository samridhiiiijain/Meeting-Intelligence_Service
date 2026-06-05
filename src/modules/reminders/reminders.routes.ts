import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { remindersController } from './reminders.controller';

/** Authenticated reminder routes: mounted at /api/reminders */
export const remindersRouter = Router();
remindersRouter.use(requireAuth);
remindersRouter.post('/run', asyncHandler(remindersController.run));
remindersRouter.get('/history', asyncHandler(remindersController.history));

/** Secret-guarded internal route: mounted at /api/internal/cron */
export const internalCronRouter = Router();
internalCronRouter.get('/reminders', asyncHandler(remindersController.cron));
