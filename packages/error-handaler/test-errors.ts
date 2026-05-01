/**
 * Test script for error handling system
 * Run with: npm run test-errors or node -r ts-node/register test-errors.ts
 */

import {
  ValidationError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  OTPExpiredError,
  BusinessLogicError,
} from './index';

import {
  validateRequiredFields,
  validateField,
  validateEmail,
  validatePassword,
  sendSuccessResponse,
  checkRateLimit,
} from './helpers';

// Test error creation and properties
function testErrorCreation() {
  console.log('🧪 Testing Error Creation...');

  try {
    const validationError = new ValidationError('Test validation error', {
      field: 'email',
      value: 'invalid-email',
    });

    console.log('✅ ValidationError created:', {
      name: validationError.name,
      message: validationError.message,
      statusCode: validationError.statusCode,
      errorCode: validationError.errorCode,
      isOperational: validationError.isOperational,
    });

    const otpError = new OTPExpiredError('OTP has expired');
    console.log('✅ OTPExpiredError created:', {
      name: otpError.name,
      statusCode: otpError.statusCode,
      errorCode: otpError.errorCode,
    });
  } catch (error) {
    console.error('❌ Error creation test failed:', error);
  }
}

// Test validation helpers
function testValidationHelpers() {
  console.log('\n🧪 Testing Validation Helpers...');

  try {
    // Test required fields validation
    const missingFields = validateRequiredFields(
      {
        email: 'test@example.com',
        // name is missing
      },
      ['email', 'name']
    );

    console.log(
      '✅ Required fields validation:',
      missingFields ? missingFields.message : 'All fields present'
    );

    // Test email validation
    const emailTests = [
      'valid@example.com',
      'invalid-email',
      'test@',
      '@example.com',
    ];

    emailTests.forEach(email => {
      const emailError = validateField(email, 'email', {
        required: true,
        type: 'email',
      });
      console.log(
        `${validateEmail(email) ? '✅' : '❌'} Email "${email}":`,
        emailError ? emailError.message : 'Valid'
      );
    });

    // Test password validation
    const passwordTests = [
      'Password123!',
      'weak',
      'NoNumber!',
      'nonumber123!',
      'NOLOWERCASE123!',
    ];

    passwordTests.forEach(password => {
      const result = validatePassword(password);
      console.log(
        `${result.isValid ? '✅' : '❌'} Password "${password}":`,
        result.isValid ? 'Valid' : result.errors.join(', ')
      );
    });
  } catch (error) {
    console.error('❌ Validation test failed:', error);
  }
}

// Test rate limiting
function testRateLimiting() {
  console.log('\n🧪 Testing Rate Limiting...');

  try {
    // Test within limits
    checkRateLimit(2, 5, 60000); // 2 attempts out of 5 allowed
    console.log('✅ Rate limit check passed (within limits)');

    try {
      // Test exceeding limits
      checkRateLimit(6, 5, 60000); // 6 attempts out of 5 allowed
      console.log('❌ Rate limit check should have failed');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.log('✅ Rate limit check correctly failed:', errorMessage);
    }
  } catch (error) {
    console.error('❌ Rate limiting test failed:', error);
  }
}

// Test error serialization (for JSON responses)
function testErrorSerialization() {
  console.log('\n🧪 Testing Error Serialization...');

  try {
    const error = new BusinessLogicError('Subscription required', {
      userId: 123,
      feature: 'premium-feature',
    });

    const serialized = JSON.stringify({
      success: false,
      error: {
        type: error.name,
        code: error.errorCode,
        message: error.message,
        statusCode: error.statusCode,
        details: error.details,
        timestamp: error.timestamp,
      },
    });

    console.log('✅ Error serialization successful:', serialized);
  } catch (error) {
    console.error('❌ Error serialization failed:', error);
  }
}

// Mock response object for testing
class MockResponse {
  private _status = 200;
  private _json: any = null;

  status(code: number) {
    this._status = code;
    return this;
  }

  json(data: any) {
    this._json = data;
    return this;
  }

  getStatus() {
    return this._status;
  }
  getJson() {
    return this._json;
  }
}

// Test success response helper
function testSuccessResponse() {
  console.log('\n🧪 Testing Success Response...');

  try {
    const mockRes = new MockResponse();
    const testData = { id: 1, name: 'Test User' };

    sendSuccessResponse(
      mockRes as any,
      testData,
      'User created successfully',
      201
    );

    console.log('✅ Success response:', {
      status: mockRes.getStatus(),
      response: mockRes.getJson(),
    });
  } catch (error) {
    console.error('❌ Success response test failed:', error);
  }
}

// Run all tests
function runAllTests() {
  console.log('🚀 Running Error Handling System Tests...\n');

  testErrorCreation();
  testValidationHelpers();
  testRateLimiting();
  testErrorSerialization();
  testSuccessResponse();

  console.log('\n✅ All tests completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}

export { runAllTests };
