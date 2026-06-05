import type { NextFunction, Request, Response } from 'express';
import { z, ZodError, type ZodTypeAny } from 'zod';
import { AppError } from '../utils/errors';

export interface RequestSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/**
 * Validation middleware factory.
 *
 * Validates and (importantly) *replaces* req.body/query/params with the parsed,
 * coerced output so controllers receive clean, typed data. Any failure is turned
 * into a single VALIDATION_ERROR AppError with field-level details, which the
 * global error handler renders into the unified envelope.
 */
export function validate(schemas: RequestSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.params) req.params = schemas.params.parse(req.params);
      if (schemas.query) {
        // req.query is a read-only getter in Express 5-ish setups; assign via defineProperty-safe path
        const parsedQuery = schemas.query.parse(req.query);
        Object.keys(req.query).forEach((k) => delete (req.query as Record<string, unknown>)[k]);
        Object.assign(req.query, parsedQuery);
      }
      if (schemas.body) req.body = schemas.body.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(AppError.badRequest('Request validation failed', formatZodIssues(err)));
        return;
      }
      next(err);
    }
  };
}

function formatZodIssues(err: ZodError): Array<{ field: string; message: string }> {
  return err.issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}

/** Re-export z for schema files importing from one place. */
export { z };
