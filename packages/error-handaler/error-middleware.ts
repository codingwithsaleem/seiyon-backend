import { Request, Response, NextFunction } from 'express';
import {
  AppError,
  ValidationError,
  NotFoundError,
  RateLimitError,
} from './index';
import logger from '../../src/utils/logger';

// Enhanced error middleware with better logging and response formatting
export const errorMiddleware = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Prevent sending response if headers already sent
  if (res.headersSent) {
    return next(err);
  }

  // Set CORS headers for error responses
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );

  // Default error values
  let statusCode = 500;
  let message = 'Internal Server Error';
  let details = null;
  let errorType = 'INTERNAL_ERROR';
  let errorCode = null;

  // Enhanced error logging with request context
  const requestInfo = {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
    requestId: generateRequestId(),
  };

  // Detect suspicious paths (bot attacks, vulnerability scans)
  const suspiciousPaths = [
    '/vendor/',
    '/phpunit/',
    '/.env',
    '/wp-admin/',
    '/wp-content/',
    '/wp-includes/',
    '/phpmyadmin/',
    '/.git/',
    '/config/',
    '/admin/',
    '/test/',
    '/testing/',
  ];
  const isSuspiciousPath = suspiciousPaths.some(path =>
    req.originalUrl.toLowerCase().includes(path)
  );

  // Check if this is a body-parser JSON syntax error
  const isBodyParserError =
    err.constructor.name === 'SyntaxError' &&
    err.message?.includes('JSON') &&
    'body' in err;

  // Check if this is an AppError by instance or by name (for compiled code compatibility)
  const isAppError = err instanceof AppError || 
    ['ValidationError', 'NotFoundError', 'UnauthorizedError', 'ForbiddenError', 
     'BadRequestError', 'ConflictError', 'RateLimitError', 'InternalServerError',
     'ServiceUnavailableError', 'OTPExpiredError', 'OTPInvalidError', 'OTPAttemptsExceededError',
     'InvalidCredentialsError', 'TokenExpiredError', 'InvalidTokenError'].includes(err.constructor.name);

  if (isAppError) {
    // Handle custom application errors
    statusCode = (err as AppError).statusCode || 500;
    message = err.message;
    details = (err as AppError).details;
    errorType = err.name || err.constructor.name;
    errorCode = (err as AppError).errorCode;

    // Log with appropriate level based on status code
    if (statusCode >= 500) {
      logger.error(`[${errorType}] ${message}`, {
        statusCode,
        details,
        request: requestInfo,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      });
    } else {
      logger.warn(`[${errorType}] ${message}`, {
        statusCode,
        details,
        request: requestInfo,
      });
    }
  } else if (isBodyParserError && isSuspiciousPath) {
    // Silently handle body-parser errors on suspicious paths (likely bot attacks)
    // Don't log these to avoid polluting logs
    statusCode = 400;
    message = 'Bad Request';
    errorType = 'BAD_REQUEST';
  } else if (isBodyParserError) {
    // Body-parser JSON error on legitimate path - log as warning
    statusCode = 400;
    message = 'Invalid JSON in request body';
    errorType = 'SYNTAX_ERROR';
    logger.warn(`[MALFORMED_JSON] Invalid JSON in request body`, {
      statusCode,
      request: requestInfo,
    });
  } else {
    // Handle built-in Node.js errors and third-party errors
    switch (err.constructor.name) {
      case 'SyntaxError':
        statusCode = 400;
        message = 'Invalid JSON in request body';
        errorType = 'SYNTAX_ERROR';
        // Only log if not already handled above
        if (!isSuspiciousPath) {
          logger.warn(`[${errorType}] ${message}`, {
            statusCode,
            request: requestInfo,
          });
        }
        break;
      case 'TypeError':
        statusCode = 400;
        message = 'Invalid data type in request';
        errorType = 'TYPE_ERROR';
        logger.warn(`[${errorType}] ${message}`, {
          statusCode,
          request: requestInfo,
        });
        break;
      default:
        // Handle unexpected errors
        errorType = 'INTERNAL_ERROR';
        logger.error('[UNHANDLED_ERROR]', {
          message: err.message,
          stack: err.stack,
          request: requestInfo,
        });
    }

    // Don't expose internal error details in production
    if (
      process.env.NODE_ENV === 'production' &&
      errorType === 'INTERNAL_ERROR'
    ) {
      message = 'Something went wrong';
      details = null;
    } else if (errorType === 'INTERNAL_ERROR') {
      message = err.message || 'Internal Server Error';
      details = { stack: err.stack };
    }
  }

  // Handle database/Prisma errors with more comprehensive coverage
  if (err.message?.includes('P2002')) {
    statusCode = 409;
    message = 'Resource already exists - duplicate entry';
    errorType = 'DUPLICATE_RESOURCE';
    errorCode = 'DUPLICATE_ENTRY';
  } else if (err.message?.includes('P2025')) {
    statusCode = 404;
    message = 'Resource not found in database';
    errorType = 'NOT_FOUND';
    errorCode = 'RESOURCE_NOT_FOUND';
  } else if (err.message?.includes('P2003')) {
    statusCode = 400;
    message = 'Foreign key constraint failed';
    errorType = 'CONSTRAINT_ERROR';
    errorCode = 'FOREIGN_KEY_CONSTRAINT';
  } else if (err.message?.includes('P2014')) {
    statusCode = 400;
    message = 'Invalid relation data';
    errorType = 'RELATION_ERROR';
    errorCode = 'INVALID_RELATION';
  } else if (err.message?.includes('P1001')) {
    statusCode = 503;
    message = 'Database connection failed';
    errorType = 'SERVICE_UNAVAILABLE';
    errorCode = 'DATABASE_CONNECTION_FAILED';
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
    errorType = 'UNAUTHORIZED';
    errorCode = 'INVALID_TOKEN';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token has expired';
    errorType = 'UNAUTHORIZED';
    errorCode = 'TOKEN_EXPIRED';
  }

  // Handle multer errors (file upload)
  if (err.name === 'MulterError') {
    statusCode = 400;
    message = 'File upload error';
    errorType = 'FILE_UPLOAD_ERROR';
    errorCode = 'INVALID_FILE';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const multerErr = err as any;
    if (multerErr.code === 'LIMIT_FILE_SIZE') {
      message = 'File size too large';
      errorCode = 'FILE_TOO_LARGE';
    } else if (multerErr.code === 'LIMIT_FILE_COUNT') {
      message = 'Too many files uploaded';
      errorCode = 'TOO_MANY_FILES';
    }
  }

  // Send structured error response
  const errorResponse = {
    success: false,
    error: {
      type: errorType,
      code: errorCode,
      message,
      statusCode,
      timestamp: new Date().toISOString(),
      requestId: requestInfo.requestId,
      ...(details && { details }),
    },
    // Add metadata for frontend debugging
    meta: {
      path: req.originalUrl,
      method: req.method,
      ...(process.env.NODE_ENV === 'development' && {
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      }),
    },
  };

  // Add development-only stack trace
  if (process.env.NODE_ENV === 'development' && err.stack) {
    errorResponse.error.stack = err.stack;
  }

  // Send response with appropriate status code
  res.status(statusCode).json(errorResponse);
};

// Async error handler wrapper
export const asyncHandler = (
  fn: (
    req: Request,
    res: Response,
    next: NextFunction
  ) => Promise<unknown> | void
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 404 handler for unmatched routes
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const error = new NotFoundError(
    `Route ${req.method} ${req.originalUrl} not found`
  );
  next(error);
};

// Request timeout handler
export const timeoutHandler = (timeout: number = 30000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const timer = setTimeout(() => {
      const error = new Error('Request timeout');
      error.name = 'RequestTimeoutError';
      next(error);
    }, timeout);

    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));

    next();
  };
};

// Rate limiting error handler
export const rateLimitHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const error = new RateLimitError(
    'Too many requests from this IP, please try again later',
    {
      retryAfter: res.get('Retry-After'),
      limit: res.get('X-RateLimit-Limit'),
      remaining: res.get('X-RateLimit-Remaining'),
      reset: res.get('X-RateLimit-Reset'),
    }
  );
  next(error);
};

// Generate unique request ID for tracking
function generateRequestId(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

// Validation helper for consistent error responses
export const createValidationError = (
  field: string,
  message: string,
  value?: unknown
) => {
  return new ValidationError(`Validation failed for field: ${field}`, {
    field,
    message,
    value: process.env.NODE_ENV === 'development' ? value : undefined,
  });
};

// Export all error handling utilities
export * from './helpers';
