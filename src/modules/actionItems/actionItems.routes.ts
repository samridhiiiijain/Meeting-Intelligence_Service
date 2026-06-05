import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { actionItemsController } from './actionItems.controller';
import {
  actionItemIdParamSchema,
  createActionItemSchema,
  listActionItemsQuerySchema,
  updateStatusSchema,
} from './actionItems.schemas';

export const actionItemsRouter = Router();

actionItemsRouter.use(requireAuth);

actionItemsRouter.post('/', validate({ body: createActionItemSchema }), asyncHandler(actionItemsController.create));
// `/overdue` must be declared before any `/:id`-style route to avoid shadowing.
actionItemsRouter.get('/overdue', asyncHandler(actionItemsController.overdue));
actionItemsRouter.get('/', validate({ query: listActionItemsQuerySchema }), asyncHandler(actionItemsController.list));
actionItemsRouter.patch(
  '/:id/status',
  validate({ params: actionItemIdParamSchema, body: updateStatusSchema }),
  asyncHandler(actionItemsController.updateStatus),
);
