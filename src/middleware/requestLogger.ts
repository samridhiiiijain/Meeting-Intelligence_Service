import type { NextFunction, Request, Response } from 'express';

/*
 Structured access logging.

 Emits one structured line per completed request including: traceId (via the
 bound child logger), method, path, status, and duration. Errors (>=500) log at
 `error`, client errors (>=400) at `warn`, everything else at `info`.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const payload = {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
    };

    if (res.statusCode >= 500) {
      req.log.error(payload, 'request completed');
    } else if (res.statusCode >= 400) {
      req.log.warn(payload, 'request completed');
    } else {
      req.log.info(payload, 'request completed');
    }
  });

  next();
}
