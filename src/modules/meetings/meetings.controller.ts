import type { Request, Response } from 'express';
import { created, ok } from '../../utils/response';
import { analysisService } from '../analysis/analysis.service';
import { meetingsService } from './meetings.service';

export const meetingsController = {
  async create(req: Request, res: Response) {
    const meeting = await meetingsService.create(req.user!.id, req.body);
    created(res, meeting);
  },

  async get(req: Request, res: Response) {
    const meeting = await meetingsService.getOwned(req.user!.id, req.params.id);
    ok(res, meeting);
  },

  async list(req: Request, res: Response) {
    const result = await meetingsService.list(req.user!.id, req.query);
    ok(res, result);
  },

  async analyze(req: Request, res: Response) {
    const result = await analysisService.analyzeMeeting(req.user!.id, req.params.id);
    ok(res, result);
  },
};
