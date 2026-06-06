import express, { type Express } from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { traceId } from './middleware/traceId';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { apiLimiter, authLimiter } from './middleware/rateLimiter';
import { buildOpenApiDocument } from './openapi/document';
import { authRouter } from './modules/auth/auth.routes';
import { meetingsRouter } from './modules/meetings/meetings.routes';
import { actionItemsRouter } from './modules/actionItems/actionItems.routes';
import { internalCronRouter, remindersRouter } from './modules/reminders/reminders.routes';
import { healthRouter } from './modules/health/health.routes';
import { evaluationRouter } from './modules/evaluation/evaluation.routes';

/**
 * Assemble the Express app (exported separately from server bootstrap so it can
 * be imported by tests without binding a port or starting the scheduler).
 */
export function createApp(): Express {
  const app = express();

  // Order matters: trace id first so every log line + response carries it.
  app.use(traceId);
  app.use(cors({ origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',') }));
  app.use(express.json({ limit: '2mb' }));
  app.use(requestLogger);

  // Platform endpoints (raw, documented shapes).
  app.use('/', healthRouter);
  app.use('/api', evaluationRouter);

  // API docs (publicly accessible).
  const openapiDocument = buildOpenApiDocument();
  app.get('/openapi.json', (_req, res) => res.json(openapiDocument));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiDocument, { explorer: true }));

  // Feature routers.
  app.use('/api/auth', authLimiter, authRouter);
  app.use('/api/meetings', apiLimiter, meetingsRouter);
  app.use('/api/action-items', apiLimiter, actionItemsRouter);
  app.use('/api/reminders', apiLimiter, remindersRouter);
  app.use('/api/internal/cron', internalCronRouter);

  // 404 + centralized error handler (registered last).
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
