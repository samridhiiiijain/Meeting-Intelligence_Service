import type { Logger } from 'pino';

/**
 * Request augmentation: trace id, per-request logger, and the authenticated user
 * (set by the auth guard). Kept in one place so all middleware/controllers share
 * the same typed surface.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      traceId: string;
      log: Logger;
      user?: {
        id: string;
        email: string;
      };
    }
  }
}

export {};
