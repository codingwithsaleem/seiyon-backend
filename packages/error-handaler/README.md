# Enhanced Error Handling System Documentation

## Overview

This enhanced error handling system provides robust, consistent, and frontend-friendly error
management for your Node.js/Express application. It includes comprehensive error classes,
middleware, validation helpers, and utilities.

## Key Features

- ✅ **Structured Error Responses**: Consistent JSON error format for frontend consumption
- ✅ **Comprehensive Error Types**: 15+ specific error classes for different scenarios
- ✅ **Request Context Logging**: Detailed logging with request metadata
- ✅ **Validation Helpers**: Built-in field validation with custom rules
- ✅ **Database Error Mapping**: Automatic Prisma error translation
- ✅ **CORS Support**: Proper CORS headers in error responses
- ✅ **Development/Production Modes**: Different error details based on environment
- ✅ **Rate Limiting Support**: Built-in rate limit error handling
- ✅ **Async Error Wrapping**: Automatic async error catching

## Error Response Format

All errors follow this consistent structure:

```json
{
  "success": false,
  "error": {
    "type": "VALIDATION_ERROR",
    "code": "INVALID_EMAIL",
    "message": "Invalid email format",
    "statusCode": 400,
    "timestamp": "2024-01-15T10:30:00.000Z",
    "requestId": "abc123def456",
    "details": {
      "field": "email",
      "value": "invalid-email"
    }
  },
  "meta": {
    "path": "/api/v1/auth/register",
    "method": "POST"
  }
}
```

## Available Error Classes

### Base Errors

- `AppError` - Base class for all application errors
- `ValidationError` - 400 - Invalid request data
- `UnauthorizedError` - 401 - Authentication required
- `ForbiddenError` - 403 - Access denied
- `NotFoundError` - 404 - Resource not found
- `ConflictError` - 409 - Resource conflict
- `RateLimitError` - 429 - Too many requests
- `InternalServerError` - 500 - Internal server error
- `BadGatewayError` - 502 - Bad gateway
- `ServiceUnavailableError` - 503 - Service unavailable

### Specialized Errors

- `DatabaseError` - Database operation failures
- `EmailServiceError` - Email service failures
- `InvalidCredentialsError` - Invalid login credentials
- `TokenExpiredError` - JWT token expired
- `InvalidTokenError` - Invalid JWT token
- `OTPExpiredError` - OTP verification expired
- `OTPInvalidError` - Invalid OTP code
- `OTPAttemptsExceededError` - Too many OTP attempts
- `PayloadTooLargeError` - Request payload too large
- `UnsupportedMediaTypeError` - Unsupported media type
- `ExternalServiceError` - External service failures
- `BusinessLogicError` - Business rule violations
- `ResourceLockedError` - Resource currently locked

## Usage Examples

### 1. Basic Controller with Error Handling

```typescript
import {
  asyncHandler,
  sendSuccessResponse,
  ValidationError,
} from '../error-handaler/error-middleware';

export const createUser = asyncHandler(async (req, res) => {
  const { email, name } = req.body;

  // Validation (throws ValidationError if invalid)
  const validationError = validateRequiredFields(req.body, ['email', 'name']);
  if (validationError) {
    throw validationError;
  }

  // Database operation (throws DatabaseError if fails)
  const user = await handleDatabaseOperation(
    () => prisma.user.create({ data: { email, name } }),
    'creating user'
  );

  // Success response
  sendSuccessResponse(res, user, 'User created successfully', 201);
});
```

### 2. Field Validation

```typescript
// Simple validation
const emailError = validateField(email, 'email', {
  required: true,
  type: 'email',
});

// Complex validation
const passwordError = validateField(password, 'password', {
  required: true,
  type: 'password', // Checks strength requirements
  minLength: 8,
});

// Custom validation
const ageError = validateField(age, 'age', {
  required: true,
  type: 'number',
  min: 18,
  max: 120,
  custom: value => Number.isInteger(value),
});
```

### 3. Database Error Handling

```typescript
// Wrap database operations
const user = await handleDatabaseOperation(
  () => prisma.user.findUnique({ where: { id } }),
  'fetching user'
);

// Check if resource exists
await checkResourceExists(user, 'User');
```

### 4. Rate Limiting

```typescript
// Check rate limits
checkRateLimit(
  userAttempts,
  5, // max attempts
  15 * 60 * 1000, // 15 minutes
  lastAttemptTime
);
```

### 5. Custom Business Logic Errors

```typescript
// Throw specific business logic errors
if (user.accountStatus === 'suspended') {
  throw new ForbiddenError('Account is suspended');
}

if (subscription.isExpired()) {
  throw new BusinessLogicError('Subscription has expired', {
    subscriptionId: subscription.id,
    expiredAt: subscription.expiresAt,
  });
}
```

## Middleware Setup

In your `server.ts`:

```typescript
import { errorMiddleware, notFoundHandler, asyncHandler } from './error-handaler/error-middleware';

// Routes
app.use('/api/v1', v1Router);

// 404 handler for unmatched routes
app.use(notFoundHandler);

// Global error handling middleware (must be last)
app.use(errorMiddleware);
```

## Environment Configuration

### Development Mode

- Detailed error messages
- Stack traces included
- Request metadata in responses
- Verbose logging

### Production Mode

- Generic error messages for security
- No stack traces
- Minimal error details
- Structured logging only

Set `NODE_ENV=production` for production behavior.

## Logging Features

Error logs include:

- Error type and message
- HTTP status code
- Request context (method, URL, IP, user agent)
- Timestamp
- Request ID for tracking
- Stack trace (development only)

Example log output:

```
[VALIDATION_ERROR] Invalid email format {
  statusCode: 400,
  details: { field: 'email' },
  request: {
    method: 'POST',
    url: '/api/v1/auth/register',
    ip: '127.0.0.1',
    userAgent: 'Mozilla/5.0...',
    timestamp: '2024-01-15T10:30:00.000Z',
    requestId: 'abc123def456'
  }
}
```

## Frontend Integration

The structured error responses make it easy for frontends to:

1. **Display User-Friendly Messages**: Use the `message` field
2. **Handle Specific Error Types**: Switch on the `type` field
3. **Show Field-Specific Errors**: Use the `details.field` for validation errors
4. **Implement Retry Logic**: Use `statusCode` and `code` for retry decisions
5. **Track Issues**: Use `requestId` for support requests

### Frontend Error Handling Example

```typescript
// Frontend error handler
const handleApiError = error => {
  const { type, code, message, statusCode } = error.error;

  switch (type) {
    case 'VALIDATION_ERROR':
      // Show field-specific errors
      showFieldError(error.error.details?.field, message);
      break;
    case 'UNAUTHORIZED':
      // Redirect to login
      redirectToLogin();
      break;
    case 'RATE_LIMIT_EXCEEDED':
      // Show retry message
      showRetryMessage(error.error.details?.resetTime);
      break;
    default:
      // Show generic error
      showErrorMessage(message);
  }
};
```

## Best Practices

1. **Use `asyncHandler`**: Wrap all async route handlers
2. **Throw, Don't Return**: Use `throw new Error()` instead of `next(error)`
3. **Validate Early**: Check required fields and formats first
4. **Use Specific Errors**: Choose the most appropriate error class
5. **Include Context**: Add relevant details to error objects
6. **Log Appropriately**: Use different log levels based on severity
7. **Test Error Paths**: Ensure error handling works correctly

## Security Considerations

- Generic error messages in production
- No sensitive data in error responses
- Rate limiting for authentication attempts
- Request validation to prevent injection attacks
- Proper CORS configuration

This enhanced error handling system provides a solid foundation for building robust, user-friendly
APIs with excellent error management and debugging capabilities.
