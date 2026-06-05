import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';
import { buildError } from '../utils/response';
import { isProd } from '../config/env';

/**
 * Centralized error handler (registered last).
 *
 * Maps any error into the unified error envelope:
 *  - AppError              → its own code/status/details
 *  - ZodError              → VALIDATION_ERROR (defensive; validate() usually catches first)
 *  - Prisma known errors   → friendly CONFLICT / NOT_FOUND / VALIDATION_ERROR
 *  - body-parser JSON error → VALIDATION_ERROR (malformed JSON)
 *  - anything else         → INTERNAL_ERROR (message hidden in prod)
 *
 * The app never crashes on bad input — everything resolves to a JSON response.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const traceId = (res.locals.traceId as string) || req.traceId;

  if (err instanceof AppError) {
    res.status(err.status).json(buildError(traceId, err.code, err.message, err.details));
    return;
  }

  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({
      field: i.path.join('.') || '(root)',
      message: i.message,
    }));
    res.status(400).json(buildError(traceId, 'VALIDATION_ERROR', 'Request validation failed', details));
    return;
  }

  // Malformed JSON body (raised by express.json())
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json(buildError(traceId, 'VALIDATION_ERROR', 'Malformed JSON in request body'));
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = mapPrismaError(err);
    res.status(mapped.status).json(buildError(traceId, mapped.code, mapped.message));
    return;
  }

  // Unexpected — log full detail, expose minimal info.
  req.log?.error({ err }, 'Unhandled error');
  res
    .status(500)
    .json(
      buildError(
        traceId,
        'INTERNAL_ERROR',
        isProd ? 'An unexpected error occurred' : String((err as Error)?.message ?? err),
      ),
    );
}

function mapPrismaError(err: Prisma.PrismaClientKnownRequestError): {
  status: number;
  code: 'CONFLICT' | 'NOT_FOUND' | 'VALIDATION_ERROR' | 'INTERNAL_ERROR';
  message: string;
} {
  switch (err.code) {
    case 'P2002':
      return { status: 409, code: 'CONFLICT', message: 'A record with this value already exists' };
    case 'P2025':
      return { status: 404, code: 'NOT_FOUND', message: 'Requested record was not found' };
    case 'P2003':
      return { status: 400, code: 'VALIDATION_ERROR', message: 'Related record does not exist' };
    default:
      return { status: 500, code: 'INTERNAL_ERROR', message: 'Database error' };
  }
}
