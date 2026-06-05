import { Router } from 'express';

export const healthRouter = Router();

/**
 * Liveness probe. Returns the exact documented shape `{ "status": "UP" }`
 * (intentionally NOT wrapped in the API envelope — it is a platform health check).
 */
healthRouter.get('/health', (_req, res) => {
  res.status(200).json({ status: 'UP' });
});
