import { Router } from 'express';
import { env } from '../../config/env';
import { EXTERNAL_INTEGRATION_NAME, FEATURES } from '../../config/constants';

export const evaluationRouter = Router();

/**
 * Evaluation metadata endpoint. Returns the documented raw shape so automated
 * graders can read candidate/deployment info directly.
 */
evaluationRouter.get('/evaluation', (_req, res) => {
  res.status(200).json({
    candidateName: env.CANDIDATE_NAME,
    email: env.CANDIDATE_EMAIL,
    repositoryUrl: env.REPOSITORY_URL,
    deployedUrl: env.DEPLOYED_URL,
    externalIntegration: EXTERNAL_INTEGRATION_NAME,
    features: FEATURES,
  });
});
