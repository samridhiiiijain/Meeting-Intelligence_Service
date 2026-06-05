import type { NextFunction, Request, Response, RequestHandler } from 'express';

/**
 * Wraps an async route handler so any thrown/rejected error is forwarded to the
 * centralized Express error handler instead of crashing the process or hanging
 * the request. Lets controllers be written as plain `async` functions.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
