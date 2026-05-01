export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: any;
  public readonly timestamp: Date;
  public readonly errorCode?: string;

  constructor(
    message: string,
    statusCode: number,
    isOperational = true,
    details?: any,
    errorCode?: string
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    this.timestamp = new Date();
    this.errorCode = errorCode;

    // Set the prototype explicitly to maintain the instance of Error
    Object.setPrototypeOf(this, new.target.prototype);

    // Capture the stack trace for debugging
    Error.captureStackTrace(this);
  }
}

// Validation Error - 400
export class ValidationError extends AppError {
  constructor(message: string = 'Invalid request data', details?: any) {
    super(message, 400, true, details, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

// Not Found Error - 404
export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found', details?: any) {
    super(message, 404, true, details, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

// Unauthorized Error - 401
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Authentication required', details?: any) {
    super(message, 401, true, details, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

// Forbidden Error - 403
export class ForbiddenError extends AppError {
  constructor(message: string = 'Access denied', details?: any) {
    super(message, 403, true, details, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

// BadRequestError - 400
export class BadRequestError extends AppError {
  constructor(message: string = 'Bad request', details?: any) {
    super(message, 400, true, details, 'BAD_REQUEST');
    this.name = 'BadRequestError';
  }
}

// Conflict Error - 409
export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict', details?: any) {
    super(message, 409, true, details, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

// Rate Limit Error - 429
export class RateLimitError extends AppError {
  constructor(
    message: string = 'Too many requests, please try again later',
    details?: any
  ) {
    super(message, 429, true, details, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
  }
}

// Internal Server Error - 500
export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error', details?: any) {
    super(message, 500, false, details, 'INTERNAL_ERROR');
    this.name = 'InternalServerError';
  }
}

// Service Unavailable Error - 503
export class ServiceUnavailableError extends AppError {
  constructor(
    message: string = 'Service temporarily unavailable',
    details?: any
  ) {
    super(message, 503, true, details, 'SERVICE_UNAVAILABLE');
    this.name = 'ServiceUnavailableError';
  }
}

// Bad Gateway Error - 502
export class BadGatewayError extends AppError {
  constructor(message: string = 'Bad gateway', details?: any) {
    super(message, 502, true, details, 'BAD_GATEWAY');
    this.name = 'BadGatewayError';
  }
}

// Database Error - Custom handler for Prisma errors
export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed', details?: any) {
    super(message, 500, false, details, 'DATABASE_ERROR');
    this.name = 'DatabaseError';
  }
}

// Email Service Error
export class EmailServiceError extends AppError {
  constructor(message: string = 'Email service failed', details?: any) {
    super(message, 503, true, details, 'EMAIL_SERVICE_ERROR');
    this.name = 'EmailServiceError';
  }
}

// Authentication Errors
export class InvalidCredentialsError extends UnauthorizedError {
  constructor(message: string = 'Invalid email or password') {
    super(message, { errorCode: 'INVALID_CREDENTIALS' });
    this.name = 'InvalidCredentialsError';
  }
}

export class TokenExpiredError extends UnauthorizedError {
  constructor(message: string = 'Token has expired') {
    super(message, { errorCode: 'TOKEN_EXPIRED' });
    this.name = 'TokenExpiredError';
  }
}

export class InvalidTokenError extends UnauthorizedError {
  constructor(message: string = 'Invalid token') {
    super(message, { errorCode: 'INVALID_TOKEN' });
    this.name = 'InvalidTokenError';
  }
}

// OTP/Verification Errors
export class OTPExpiredError extends UnauthorizedError {
  constructor(message: string = 'OTP has expired') {
    super(message, { errorCode: 'OTP_EXPIRED' });
    this.name = 'OTPExpiredError';
  }
}

export class OTPInvalidError extends UnauthorizedError {
  constructor(message: string = 'Invalid OTP') {
    super(message, { errorCode: 'OTP_INVALID' });
    this.name = 'OTPInvalidError';
  }
}

export class OTPAttemptsExceededError extends RateLimitError {
  constructor(
    message: string = 'Too many OTP attempts, please try again later'
  ) {
    super(message, { errorCode: 'OTP_ATTEMPTS_EXCEEDED' });
    this.name = 'OTPAttemptsExceededError';
  }
}

// Request/File Upload Errors
export class PayloadTooLargeError extends AppError {
  constructor(message: string = 'Request payload too large') {
    super(
      message,
      413,
      true,
      { errorCode: 'PAYLOAD_TOO_LARGE' },
      'PAYLOAD_TOO_LARGE'
    );
    this.name = 'PayloadTooLargeError';
  }
}

export class UnsupportedMediaTypeError extends AppError {
  constructor(message: string = 'Unsupported media type') {
    super(
      message,
      415,
      true,
      { errorCode: 'UNSUPPORTED_MEDIA_TYPE' },
      'UNSUPPORTED_MEDIA_TYPE'
    );
    this.name = 'UnsupportedMediaTypeError';
  }
}

// External Service Errors
export class ExternalServiceError extends ServiceUnavailableError {
  constructor(service: string, message?: string) {
    super(message || `${service} service is currently unavailable`, {
      service,
      errorCode: 'EXTERNAL_SERVICE_ERROR',
    });
    this.name = 'ExternalServiceError';
  }
}

// Business Logic Errors
export class BusinessLogicError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 422, true, details, 'BUSINESS_LOGIC_ERROR');
    this.name = 'BusinessLogicError';
  }
}

export class ResourceLockedError extends ConflictError {
  constructor(message: string = 'Resource is currently locked') {
    super(message, { errorCode: 'RESOURCE_LOCKED' });
    this.name = 'ResourceLockedError';
  }
}
