import { z } from 'zod';

export const ACTION_ITEM_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED'] as const;

export const createActionItemSchema = z.object({
  task: z.string().min(1, 'task is required').max(500),
  meetingId: z.string().uuid('meetingId must be a UUID').optional(),
  assignee: z.string().min(1).max(200).optional(),
  status: z.enum(ACTION_ITEM_STATUSES).optional(),
  dueDate: z
    .string()
    .datetime({ message: 'dueDate must be an ISO-8601 datetime' })
    .optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(ACTION_ITEM_STATUSES, {
    errorMap: () => ({ message: `status must be one of: ${ACTION_ITEM_STATUSES.join(', ')}` }),
  }),
});

export const listActionItemsQuerySchema = z.object({
  status: z.enum(ACTION_ITEM_STATUSES).optional(),
  assignee: z.string().trim().min(1).optional(),
  meetingId: z.string().uuid('meetingId must be a UUID').optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export const actionItemIdParamSchema = z.object({
  id: z.string().uuid('Action item id must be a UUID'),
});

export type CreateActionItemInput = z.infer<typeof createActionItemSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type ListActionItemsQuery = z.infer<typeof listActionItemsQuerySchema>;
