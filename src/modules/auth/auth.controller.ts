import type { Request, Response } from 'express';
import { created, ok } from '../../utils/response';
import { authService } from './auth.service';

export const authController = {
  async register(req: Request, res: Response) {
    const result = await authService.register(req.body);
    created(res, result);
  },

  async login(req: Request, res: Response) {
    const result = await authService.login(req.body);
    ok(res, result);
  },

  async me(req: Request, res: Response) {
    const user = await authService.me(req.user!.id);
    ok(res, user);
  },
};
