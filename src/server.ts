import 'reflect-metadata';
import 'module-alias/register';
import 'dotenv-flow/config';

import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';

import {
  errorMiddleware,
  notFoundHandler,
} from '../packages/error-handaler/error-middleware';
import { swaggerSpec } from './config/swagger';
import healthRouter from './routes/health.router';
import { logger } from './utils/logger';
import v1Router from './routes/v1';

// Initialize Express app
const app = express();

// Configuration
const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = process.env.APP_PORT || 6001; // Default to 6001 if not set
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}/api/v1`;

// Trust proxy for production deployments
app.set('trust proxy', 1);

// =================================
// SECURITY MIDDLEWARE
// =================================

if (process.env.ENABLE_HELMET !== 'false') {
  app.use(
    helmet({
      contentSecurityPolicy: false, // Disabled to allow Swagger UI to work
      crossOriginEmbedderPolicy: false,
    })
  );
}

// Rate limiting
if (process.env.ENABLE_RATE_LIMITING !== 'false') {
  const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '2000'),
    message: {
      error: 'Too many requests from this IP, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', limiter);
}

// =================================
// CORS CONFIGURATION
// =================================

const corsOrigins = process.env.CORS_ORIGINS?.split(',') || [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:6001',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);

      if (corsOrigins.includes(origin) || NODE_ENV === 'development') {
        return callback(null, true);
      }

      const msg = `The CORS policy for this origin doesn't allow access from the particular origin: ${origin}`;
      return callback(new Error(msg), false);
    },
    credentials: process.env.CORS_CREDENTIALS === 'true',
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-API-Key',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  })
);

// =================================
// GENERAL MIDDLEWARE
// =================================

// Compression middleware
if (process.env.ENABLE_COMPRESSION !== 'false') {
  app.use(compression());
}

// Logging middleware
app.use(
  morgan(NODE_ENV === 'production' ? 'combined' : 'dev', {
    stream: {
      write: (message: string) => {
        logger.info(message.trim());
      },
    },
  })
);

// Body parsing middleware
app.use(
  express.json({
    limit: process.env.MAX_JSON_SIZE || '10mb',
    type: ['application/json', 'text/plain'],
  })
);
app.use(
  express.urlencoded({
    limit: process.env.MAX_JSON_SIZE || '10mb',
    extended: true,
  })
);

// Cookie parser
app.use(cookieParser(process.env.COOKIE_SECRET));

// =================================
// API DOCUMENTATION
// =================================

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customSiteTitle: 'Seiyon Car Rental API Documentation',
}));
app.get('/api-docs.json', (req: Request, res: Response) => {
  res.json(swaggerSpec);
});

// =================================
// HEALTH CHECK & METRICS
// =================================

// Basic health check
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: process.env.APP_NAME,
    version: process.env.APP_VERSION || '1.0.0',
    environment: NODE_ENV,
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

// =================================
// ROUTES
// =================================

app.use('/health', healthRouter);
app.use('/api/v1', v1Router);

// =================================
// ERROR HANDLING
// =================================

// Handle 404 for unmatched routes
app.use(notFoundHandler);

// Global error handling middleware (must be last)
app.use(errorMiddleware);

// =================================
// SERVER STARTUP
// =================================

const server = app.listen(PORT, async () => {
  logger.info(`🚀 Server listening at ${BASE_URL}`);
  logger.info(`📚 Swagger docs available at ${process.env.SWAGGER_URL}`);
  logger.info(`🌍 Environment: ${NODE_ENV}`);
  logger.info(`🔧 Process ID: ${process.pid}`);

  if (NODE_ENV === 'development') {
    logger.info(`🔍 Health check: http://localhost:${PORT}/health`);
    logger.info(`📊 API base URL: ${BASE_URL}`);
  }
});

// Handle server errors
server.on('error', error => {
  logger.error('❌ Server error:', error);
});

// =================================
// ERROR HANDLING & GRACEFUL SHUTDOWN
// =================================

// Handle server errors
server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof PORT === 'string' ? 'Pipe ' + PORT : 'Port ' + PORT;

  switch (error.code) {
    case 'EACCES':
      logger.error(`${bind} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      logger.error(`${bind} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
});

// Graceful shutdown handlers
const gracefulShutdown = (signal: string) => {
  logger.info(`${signal} received, shutting down gracefully`);

  server.close(err => {
    if (err) {
      logger.error('Error during server shutdown:', err);
      process.exit(1);
    }

    logger.info('HTTP server closed');

    // Close database connections, cleanup resources, etc.
    // prisma.$disconnect().catch((err) => logger.error('Error disconnecting from database:', err));

    process.exit(0);
  });

  // Force close after timeout
  setTimeout(() => {
    logger.error(
      'Could not close connections in time, forcefully shutting down'
    );
    process.exit(1);
  }, 10000);
};

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections
process.on(
  'unhandledRejection',
  (reason: unknown, promise: Promise<unknown>) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('UNHANDLED_REJECTION');
  }
);

// Export for testing
export default app;
export { server };
