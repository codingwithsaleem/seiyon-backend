import prisma from '@packages/libs/prisma';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import logger from '../../../src/utils/logger';
import { sendOtpEmail } from './auth.helper';
import { OtpType, Gender } from '@prisma/client';
import {
  NotFoundError,
  ConflictError,
  BadRequestError,
  UnauthorizedError,
  OTPExpiredError,
  OTPInvalidError,
  OTPAttemptsExceededError,
} from '../../../packages/error-handaler';

// =================================
// USER PROFILE FUNCTIONS
// =================================

/**
 * Get user profile
 */
export async function getUserProfile(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        isEmailVerified: true,
        firstName: true,
        lastName: true,
        fullName: true,
        username: true,
        avatar: true,
        bio: true,
        phone: true,
        phoneVerified: true,
        age: true,
        gender: true,
        address: true,
        city: true,
        state: true,
        country: true,
        postalCode: true,
        timezone: true,
        language: true,
        preferredCurrency: true,
        provider: true,
        status: true,
        role: true,
        notificationsEnabled: true,
        pushEnabled: true,
        emailNotifEnabled: true,
        smsNotifEnabled: true,
        lastLoginAt: true,
        lastActiveAt: true,
        createdAt: true,
        updatedAt: true,
        countyId: true,
        county: {
          select: {
            id: true,
            name: true,
            state: true,
            slug: true,
            coverImage: true,
          },
        },
        userCounties: {
          where: { isActive: true },
          select: {
            county: {
              select: {
                id: true,
                name: true,
                state: true,
                slug: true,
                coverImage: true,
              },
            },
            notificationsEnabled: true,
            followedAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return user;
  } catch (error) {
    logger.error('Failed to get user profile', {
      error: error instanceof Error ? error.message : String(error),
      userId,
    });
    throw error;
  }
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  userId: string,
  data: {
    fullName?: string;
    age?: number;
    gender?: Gender;
    avatar?: string;
    countyId?: string | null;
  }
) {
  try {
    // If countyId is provided, verify it exists
    if (data.countyId !== undefined && data.countyId !== null && data.countyId !== '') {
      const county = await prisma.county.findUnique({
        where: { id: data.countyId },
        select: { id: true },
      });

      if (!county) {
        throw new NotFoundError('County not found');
      }
    }

    // Update user profile
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        age: true,
        gender: true,
        language: true,
        countyId: true,
        county: {
          select: {
            id: true,
            name: true,
            state: true,
            slug: true,
            coverImage: true,
          },
        },
        updatedAt: true,
      },
    });

    logger.info('User profile updated', { userId });
    return user;
  } catch (error) {
    logger.error('Failed to update user profile', {
      error: error instanceof Error ? error.message : String(error),
      userId,
    });
    throw error;
  }
}

/**
 * Update user language
 */
export async function updateUserLanguage(userId: string, language: string) {
  try {
    const supportedLanguages = ['en', 'es', 'fr', 'de', 'pt', 'ar'];

    if (!supportedLanguages.includes(language)) {
      throw new BadRequestError(
        `Unsupported language. Supported: ${supportedLanguages.join(', ')}`
      );
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { language },
      select: {
        id: true,
        language: true,
      },
    });

    logger.info('User language updated', { userId, language });
    return user;
  } catch (error) {
    logger.error('Failed to update user language', {
      error: error instanceof Error ? error.message : String(error),
      userId,
    });
    throw error;
  }
}

/**
 * Update user currency
 */
export async function updateUserCurrency(userId: string, currency: string) {
  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { preferredCurrency: currency.toUpperCase() },
      select: {
        id: true,
        preferredCurrency: true,
      },
    });

    logger.info('User currency updated', { userId, currency });
    return user;
  } catch (error) {
    logger.error('Failed to update user currency', {
      error: error instanceof Error ? error.message : String(error),
      userId,
    });
    throw error;
  }
}

// =================================
// EMAIL & PHONE UPDATE FUNCTIONS
// =================================

/**
 * Request email change (send OTP to new email)
 */
export async function requestEmailChange(
  userId: string,
  newEmail: string
): Promise<void> {
  try {
    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: newEmail },
    });

    if (existingUser) {
      throw new ConflictError('Email already in use');
    }

    // Generate 5-digit OTP
    const otp = crypto.randomInt(10000, 99999).toString();
    const expireAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Store OTP in database
    await prisma.otpVerification.upsert({
      where: { email: newEmail },
      update: {
        otp,
        expiresAt: expireAt,
        attemptCount: 0,
        verified: false,
        type: OtpType.EMAIL_VERIFICATION,
      },
      create: {
        email: newEmail,
        otp,
        type: OtpType.EMAIL_VERIFICATION,
        expiresAt: expireAt,
        attemptCount: 0,
        verified: false,
      },
    });

    // Send OTP email using the existing helper
    await sendOtpEmail(
      newEmail,
      'verifyEmailOtpTemplate',
      OtpType.EMAIL_VERIFICATION
    );

    logger.info('Email change OTP sent', { userId, newEmail });
  } catch (error) {
    logger.error('Failed to request email change', {
      error: error instanceof Error ? error.message : String(error),
      userId,
    });
    throw error;
  }
}

/**
 * Verify and update email
 */
export async function verifyAndUpdateEmail(
  userId: string,
  newEmail: string,
  otp: string
): Promise<void> {
  try {
    // Verify OTP
    const otpRecord = await prisma.otpVerification.findUnique({
      where: { email: newEmail },
    });

    if (!otpRecord) {
      throw new BadRequestError('No OTP found for this email');
    }

    if (otpRecord.expiresAt < new Date()) {
      await prisma.otpVerification.delete({ where: { email: newEmail } });
      throw new OTPExpiredError('OTP has expired');
    }

    if (otpRecord.otp !== otp) {
      // Increment attempt count
      const newAttemptCount = otpRecord.attemptCount + 1;

      if (newAttemptCount >= 5) {
        await prisma.otpVerification.delete({ where: { email: newEmail } });
        throw new OTPAttemptsExceededError(
          'Too many failed attempts. Please request a new OTP'
        );
      }

      await prisma.otpVerification.update({
        where: { email: newEmail },
        data: { attemptCount: newAttemptCount },
      });

      throw new OTPInvalidError(
        `Invalid OTP. ${5 - newAttemptCount} attempts remaining`
      );
    }

    // Update email
    await prisma.user.update({
      where: { id: userId },
      data: {
        email: newEmail,
        emailVerified: true,
        isEmailVerified: true,
      },
    });

    // Clean up OTP
    await prisma.otpVerification.delete({ where: { email: newEmail } });

    logger.info('Email updated successfully', { userId, newEmail });
  } catch (error) {
    logger.error('Failed to verify and update email', {
      error: error instanceof Error ? error.message : String(error),
      userId,
    });
    throw error;
  }
}

/**
 * Request phone change (send OTP to new phone)
 */
export async function requestPhoneChange(
  userId: string,
  newPhone: string
): Promise<void> {
  try {
    // Check if phone already exists
    const existingUser = await prisma.user.findUnique({
      where: { phone: newPhone },
    });

    if (existingUser) {
      throw new ConflictError('Phone number already in use');
    }

    // Generate 5-digit OTP
    const otp = crypto.randomInt(10000, 99999).toString();
    const expireAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Store OTP temporarily (using email field as unique key with phone prefix)
    const uniqueKey = `phone_${newPhone}`;
    await prisma.otpVerification.upsert({
      where: { email: uniqueKey },
      update: {
        otp,
        expiresAt: expireAt,
        attemptCount: 0,
        verified: false,
        type: OtpType.PHONE_VERIFICATION,
      },
      create: {
        email: uniqueKey,
        otp,
        type: OtpType.PHONE_VERIFICATION,
        expiresAt: expireAt,
        attemptCount: 0,
        verified: false,
      },
    });

    // TODO: Send OTP SMS (implement SMS service)
    // await sendOtpSMS(newPhone, otp);

    logger.info('Phone change OTP sent', { userId, newPhone });
    logger.warn('SMS not implemented yet, OTP: ' + otp); // For testing
  } catch (error) {
    logger.error('Failed to request phone change', {
      error: error instanceof Error ? error.message : String(error),
      userId,
    });
    throw error;
  }
}

/**
 * Verify and update phone
 */
export async function verifyAndUpdatePhone(
  userId: string,
  newPhone: string,
  otp: string
): Promise<void> {
  try {
    // Verify OTP using unique key
    const uniqueKey = `phone_${newPhone}`;
    const otpRecord = await prisma.otpVerification.findUnique({
      where: { email: uniqueKey },
    });

    if (!otpRecord) {
      throw new BadRequestError('No OTP found for this phone number');
    }

    if (otpRecord.expiresAt < new Date()) {
      await prisma.otpVerification.delete({ where: { email: uniqueKey } });
      throw new OTPExpiredError('OTP has expired');
    }

    if (otpRecord.otp !== otp) {
      // Increment attempt count
      const newAttemptCount = otpRecord.attemptCount + 1;

      if (newAttemptCount >= 5) {
        await prisma.otpVerification.delete({ where: { email: uniqueKey } });
        throw new OTPAttemptsExceededError(
          'Too many failed attempts. Please request a new OTP'
        );
      }

      await prisma.otpVerification.update({
        where: { email: uniqueKey },
        data: { attemptCount: newAttemptCount },
      });

      throw new OTPInvalidError(
        `Invalid OTP. ${5 - newAttemptCount} attempts remaining`
      );
    }

    // Update phone
    await prisma.user.update({
      where: { id: userId },
      data: {
        phone: newPhone,
        phoneVerified: true,
      },
    });

    // Clean up OTP
    await prisma.otpVerification.delete({ where: { email: uniqueKey } });

    logger.info('Phone updated successfully', { userId, newPhone });
  } catch (error) {
    logger.error('Failed to verify and update phone', {
      error: error instanceof Error ? error.message : String(error),
      userId,
    });
    throw error;
  }
}

// =================================
// PASSWORD CHANGE FUNCTION
// =================================

/**
 * Change user password
 */
export async function changeUserPassword(
  userId: string,
  oldPassword: string,
  newPassword: string
): Promise<void> {
  try {
    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true, provider: true },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Check if user uses SSO (no password)
    if (user.provider && !user.password) {
      throw new BadRequestError(
        'Cannot change password for SSO users. Please use your SSO provider.'
      );
    }

    // Verify old password
    const isValidPassword = await bcrypt.compare(oldPassword, user.password);
    if (!isValidPassword) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(
      newPassword,
      parseInt(process.env.BCRYPT_ROUNDS || '12')
    );

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        passwordResetAt: new Date(),
      },
    });

    logger.info('Password changed successfully', { userId });
  } catch (error) {
    logger.error('Failed to change password', {
      error: error instanceof Error ? error.message : String(error),
      userId,
    });
    throw error;
  }
}

/**
 * Delete user account (soft delete)
 */
export async function deleteUserAccount(
  userId: string,
  reasons: string[],
  feedback?: string,
  userAgent?: string,
  ipAddress?: string
): Promise<void> {
  try {
    // Get user info before deletion
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Save account deletion feedback
    await prisma.accountDeletion.create({
      data: {
        userId: user.id,
        email: user.email,
        fullName: user.fullName,
        userRole: user.role,
        reasons,
        feedback,
        deletedBy: 'user',
        userAgent,
        ipAddress,
      },
    });

    // Hard delete user (cascade will delete related data)
    await prisma.user.delete({
      where: { id: userId },
    });

    logger.info('User account deleted permanently', {
      userId,
      email: user.email,
    });
  } catch (error) {
    logger.error('Failed to delete user account', {
      error: error instanceof Error ? error.message : String(error),
      userId,
    });
    throw error;
  }
}
