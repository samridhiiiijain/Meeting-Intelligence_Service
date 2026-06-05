import type { Response } from 'express';
import type { ErrorCode } from './errors';

/**
 * Unified API response envelope.
 *
 * Success: { traceId, success: true, data }
 * Error:   { traceId, success: false, error: { code, message, details? } }
 *
 * Every controller returns through these helpers so the shape is identical
 * across the whole API (a non-functional requirement of the assignment).
 */

export interface SuccessEnvelope<T> {
  traceId: string;
  success: true;
  data: T;
}

export interface ErrorEnvelope {
  traceId: string;
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

export function buildSuccess<T>(traceId: string, data: T): SuccessEnvelope<T> {
  return { traceId, success: true, data };
}

export function buildError(
  traceId: string,
  code: ErrorCode,
  message: string,
  details?: unknown,
): ErrorEnvelope {
  return {
    traceId,
    success: false,
    error: details === undefined ? { code, message } : { code, message, details },
  };
}

/** Send a success envelope. Defaults to HTTP 200. */
export function ok<T>(res: Response, data: T, status = 200): Response {
  return res.status(status).json(buildSuccess(res.locals.traceId as string, data));
}

/** Send a 201 Created success envelope. */
export function created<T>(res: Response, data: T): Response {
  return ok(res, data, 201);
}
