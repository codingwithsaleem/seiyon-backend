import express from 'express';
import { healthCheck } from '../controller/health.controller';

const healthRouter = express.Router();

/**
 * GET /health
 * @tags Health
 * @summary Application health check
 * @description Returns the health status of the application and its dependencies
 * @return {object} 200 - Health status
 * @return {object} 503 - Service unavailable
 */
healthRouter.get('/', healthCheck);

export default healthRouter;
