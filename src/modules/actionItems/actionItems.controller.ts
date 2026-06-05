import type { Request, Response } from 'express';
import { created, ok } from '../../utils/response';
import { actionItemsService } from './actionItems.service';

export const actionItemsController = {
  async create(req: Request, res: Response) {
    const item = await actionItemsService.create(req.user!.id, req.body);
    created(res, item);
  },

  async updateStatus(req: Request, res: Response) {
    const item = await actionItemsService.updateStatus(req.user!.id, req.params.id, req.body.status);
    ok(res, item);
  },

  async list(req: Request, res: Response) {
    const result = await actionItemsService.list(req.user!.id, req.query);
    ok(res, result);
  },

  async overdue(req: Request, res: Response) {
    const result = await actionItemsService.listOverdue(req.user!.id, req.query);
    ok(res, result);
  },
};
