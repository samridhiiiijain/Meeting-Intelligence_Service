import rateLimit, { type Options } from 'express-rate-limit';
import type { Request, Response } from 'express';
import { buildError } from '../utils/response';

const handler: Options['handler'] = (req: Request, res: Response) => {
  const traceId = (res.locals.traceId as string) || req.traceId;
  res.status(429).json(buildError(traceId, 'RATE_LIMITED', 'Too many requests — please slow down'));
};

/** General API limiter: 100 requests / 5 min per IP. */
export const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

/** Tighter limiter for auth endpoints: 20 requests / 5 min per IP. */
export const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});
