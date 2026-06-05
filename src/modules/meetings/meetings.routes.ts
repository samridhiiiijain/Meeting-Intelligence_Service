import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { meetingsController } from './meetings.controller';
import {
  createMeetingSchema,
  listMeetingsQuerySchema,
  meetingIdParamSchema,
} from './meetings.schemas';

export const meetingsRouter = Router();

meetingsRouter.use(requireAuth);

meetingsRouter.post('/', validate({ body: createMeetingSchema }), asyncHandler(meetingsController.create));
meetingsRouter.get('/', validate({ query: listMeetingsQuerySchema }), asyncHandler(meetingsController.list));
meetingsRouter.get('/:id', validate({ params: meetingIdParamSchema }), asyncHandler(meetingsController.get));
meetingsRouter.post(
  '/:id/analyze',
  validate({ params: meetingIdParamSchema }),
  asyncHandler(meetingsController.analyze),
);
