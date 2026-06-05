import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';

/** Catch-all for unmatched routes → 404 in the unified envelope. */
export function notFound(req: Request, _res: Response, next: NextFunction): void {
  next(AppError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}
