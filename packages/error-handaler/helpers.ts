import { Request, Response, NextFunction } from 'express';
import {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ConflictError,
  DatabaseError,
} from './index';

/**
 * Utility functions for consistent error handling across controllers
 */

// Standard success response wrapper
export const sendSuccessResponse = (
  res: Response,
  data: any,
  message: string = 'Success',
  statusCode: number = 200
) => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
};

// Paginated response wrapper
export const sendPaginatedResponse = (
  res: Response,
  data: any[],
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  },
  message: string = 'Success'
) => {
  res.status(200).json({
    success: true,
    message,
    data,
    pagination,
    timestamp: new Date().toISOString(),
  });
};

// Validation helper for request body
export const validateRequiredFields = (
  body: any,
  requiredFields: string[]
): ValidationError | null => {
  const missingFields: string[] = [];

  for (const field of requiredFields) {
    if (
      body[field] === undefined ||
      body[field] === null ||
      body[field] === ''
    ) {
      missingFields.push(field);
    }
  }

  if (missingFields.length > 0) {
    return new ValidationError(
      `Missing required fields: ${missingFields.join(', ')}`,
      { missingFields }
    );
  }

  return null;
};

// Email validation helper
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Password strength validation
export const validatePassword = (
  password: string
): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Generic field validation with custom rules
export const validateField = (
  value: any,
  fieldName: string,
  rules: {
    required?: boolean;
    type?: 'string' | 'number' | 'boolean' | 'email' | 'password';
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: RegExp;
    custom?: (value: any) => boolean;
  }
): ValidationError | null => {
  // Check required
  if (
    rules.required &&
    (value === undefined || value === null || value === '')
  ) {
    return new ValidationError(`${fieldName} is required`);
  }

  // Skip other validations if not required and empty
  if (
    !rules.required &&
    (value === undefined || value === null || value === '')
  ) {
    return null;
  }

  // Type validation
  if (rules.type) {
    switch (rules.type) {
      case 'string':
        if (typeof value !== 'string') {
          return new ValidationError(`${fieldName} must be a string`);
        }
        break;
      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          return new ValidationError(`${fieldName} must be a valid number`);
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          return new ValidationError(`${fieldName} must be a boolean`);
        }
        break;
      case 'email':
        if (!validateEmail(value)) {
          return new ValidationError(
            `${fieldName} must be a valid email address`
          );
        }
        break;
      case 'password':
        const passwordValidation = validatePassword(value);
        if (!passwordValidation.isValid) {
          return new ValidationError(`${fieldName} validation failed`, {
            errors: passwordValidation.errors,
          });
        }
        break;
    }
  }

  // Length validation for strings
  if (typeof value === 'string') {
    if (rules.minLength && value.length < rules.minLength) {
      return new ValidationError(
        `${fieldName} must be at least ${rules.minLength} characters long`
      );
    }
    if (rules.maxLength && value.length > rules.maxLength) {
      return new ValidationError(
        `${fieldName} must be no more than ${rules.maxLength} characters long`
      );
    }
  }

  // Numeric range validation
  if (typeof value === 'number') {
    if (rules.min !== undefined && value < rules.min) {
      return new ValidationError(`${fieldName} must be at least ${rules.min}`);
    }
    if (rules.max !== undefined && value > rules.max) {
      return new ValidationError(
        `${fieldName} must be no more than ${rules.max}`
      );
    }
  }

  // Pattern validation
  if (rules.pattern && typeof value === 'string') {
    if (!rules.pattern.test(value)) {
      return new ValidationError(`${fieldName} format is invalid`);
    }
  }

  // Custom validation
  if (rules.custom && !rules.custom(value)) {
    return new ValidationError(`${fieldName} validation failed`);
  }

  return null;
};

// Helper to check if user exists and handle common scenarios
export const checkResourceExists = async (
  resource: any,
  resourceName: string = 'Resource'
): Promise<void> => {
  if (!resource) {
    throw new NotFoundError(`${resourceName} not found`);
  }
};

// Helper to check user permissions
export const checkPermission = (
  userHasPermission: boolean,
  action: string = 'perform this action'
): void => {
  if (!userHasPermission) {
    throw new UnauthorizedError(`You don't have permission to ${action}`);
  }
};

// Database error wrapper that converts Prisma errors to AppErrors
export const handleDatabaseOperation = async <T>(
  operation: () => Promise<T>,
  context: string = 'database operation'
): Promise<T> => {
  try {
    return await operation();
  } catch (error: any) {
    // Convert Prisma errors to AppErrors
    if (error.code?.startsWith('P')) {
      if (error.code === 'P2002') {
        const field = error.meta?.target?.[0] || 'field';
        throw new ConflictError(
          `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`,
          { field, constraint: 'unique' }
        );
      }

      if (error.code === 'P2025') {
        throw new NotFoundError(`Record not found during ${context}`);
      }

      throw new DatabaseError(`Database error during ${context}`, {
        code: error.code,
        meta: error.meta,
      });
    }

    // Re-throw AppErrors as-is
    if (error instanceof AppError) {
      throw error;
    }

    // Wrap other errors
    throw new DatabaseError(`Unexpected error during ${context}`, {
      originalError: error.message,
    });
  }
};

// Rate limiting helper
export const checkRateLimit = (
  attempts: number,
  maxAttempts: number,
  windowMs: number,
  lastAttempt?: Date
): void => {
  if (attempts >= maxAttempts) {
    const resetTime = lastAttempt
      ? new Date(lastAttempt.getTime() + windowMs)
      : new Date(Date.now() + windowMs);

    throw new AppError(
      `Too many attempts. Try again after ${resetTime.toISOString()}`,
      429,
      true,
      {
        maxAttempts,
        attempts,
        resetTime: resetTime.toISOString(),
      },
      'RATE_LIMIT_EXCEEDED'
    );
  }
};
