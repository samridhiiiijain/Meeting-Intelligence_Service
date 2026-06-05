import pino from 'pino';
import { env, isProd } from '../config/env';

/**
 * Structured JSON logger.
 *
 * In production we emit raw JSON (one object per line) so log aggregators can
 * parse trace IDs, status codes, etc. In development we pretty-print for humans.
 * Per-request child loggers (bound with the traceId) are created in middleware.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  base: undefined, // omit pid/hostname noise
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: isProd
    ? undefined
    : {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
      },
});

export type Logger = typeof logger;
