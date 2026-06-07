import type { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { REQUEST_ID_HEADER, TRACE_HEADER } from '../config/constants';
import { logger } from '../lib/logger';

/*
  Trace-id middleware (must run first).
 
  - Reuses an incoming `x-trace-id` / `x-request-id` header if present, else
    generates a UUID.
  - Exposes it on `req.traceId`, `res.locals.traceId` (used by response helpers),
    and echoes it back in the `x-trace-id` response header.
  - Binds a child logger with the trace id so every downstream log line is
    correlated to the request.
 */
export function traceId(req: Request, res: Response, next: NextFunction): void {
  const incoming =
    (req.header(TRACE_HEADER) || req.header(REQUEST_ID_HEADER) || '').trim();
  const id = incoming || uuidv4();

  req.traceId = id;
  res.locals.traceId = id;
  res.setHeader(TRACE_HEADER, id);
  req.log = logger.child({ traceId: id });

  next();
}
