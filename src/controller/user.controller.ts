import { Request, Response } from 'express';
import {
  asyncHandler,
  sendSuccessResponse,
  validateRequiredFields,
} from '../../packages/error-handaler/error-middleware';
import {
  getUserProfile,
  updateUserProfile,
  updateUserLanguage,
  updateUserCurrency,
  requestEmailChange,
  verifyAndUpdateEmail,
  requestPhoneChange,
  verifyAndUpdatePhone,
  changeUserPassword,
  deleteUserAccount,
} from '../../packages/utils/helpers/user.helper';
import { Gender } from '@prisma/client';
import {
  uploadProfilePicture,
  deleteOldProfilePicture,
  validateProfilePictureType,
  validateFileSize,
} from '../../packages/utils/helpers/s3.helper';
import {
  ValidationError,
  NotFoundError,
  // UnauthorizedError,
} from '../../packages/error-handaler';
// import bcrypt from 'bcryptjs';

// =================================
// PROFILE CONTROLLERS
// =================================

/**
 * Get user profile
 * @route GET /api/v1/user/profile
 */
export const getProfile = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;

    const profile = await getUserProfile(userId!);

    sendSuccessResponse(res, { user: profile }, 'Profile fetched successfully');
  }
);

/**
 * Update user profile
 * @route PATCH /api/v1/user/profile
 */
export const updateProfile = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const { fullName, age, gender, countyId } = req.body;

    // Validate countyId if provided (must be a valid UUID or null/empty to clear)
    if (countyId !== undefined && countyId !== null && countyId !== '') {
      if (typeof countyId !== 'string' || !countyId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        throw new ValidationError('Invalid county ID format');
      }
    }

    const updateData: {
      fullName?: string;
      age?: number;
      gender?: Gender;
      countyId?: string | null;
    } = {};

    if (fullName !== undefined) updateData.fullName = fullName;
    if (age !== undefined) updateData.age = age;
    if (gender !== undefined) updateData.gender = gender;
    if (countyId !== undefined) updateData.countyId = countyId || null;

    const user = await updateUserProfile(userId!, updateData);

    sendSuccessResponse(res, { user }, 'Profile updated successfully');
  }
);

/**
 * Upload profile picture
 * @route POST /api/v1/user/profile/picture
 */
export const uploadProfilePic = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;

    // Check if file exists
    if (!req.file) {
      throw new ValidationError('No file uploaded');
    }

    const file = req.file;

    // Validate file type
    const { valid, extension } = validateProfilePictureType(file.mimetype);
    if (!valid) {
      throw new ValidationError(
        'Invalid file type. Allowed: JPEG, PNG, GIF, WebP'
      );
    }

    // Validate file size (5MB max)
    if (!validateFileSize(file.size, 5)) {
      throw new ValidationError('File size too large. Maximum: 5MB');
    }

    // Get user's current avatar
    const currentUser = await getUserProfile(userId!);

    // Upload to S3
    const avatarUrl = await uploadProfilePicture(
      userId!,
      file.buffer,
      extension
    );

    // Update user profile with new avatar URL
    const user = await updateUserProfile(userId!, { avatar: avatarUrl });

    // Delete old avatar from S3 (if exists and is S3 URL)
    if (currentUser.avatar) {
      await deleteOldProfilePicture(currentUser.avatar);
    }

    sendSuccessResponse(
      res,
      { user, avatarUrl },
      'Profile picture uploaded successfully'
    );
  }
);

/**
 * Delete profile picture
 * @route DELETE /api/v1/user/profile/picture
 */
export const deleteProfilePic = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;

    const currentUser = await getUserProfile(userId!);

    // Delete from S3
    if (currentUser.avatar) {
      await deleteOldProfilePicture(currentUser.avatar);
    }

    // Remove avatar URL from profile
    const user = await updateUserProfile(userId!, { avatar: '' });

    sendSuccessResponse(res, { user }, 'Profile picture deleted successfully');
  }
);

// =================================
// LANGUAGE & CURRENCY CONTROLLERS
// =================================

/**
 * Update user language
 * @route PATCH /api/v1/user/language
 */
export const updateLanguage = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const { language } = req.body;

    const validationError = validateRequiredFields(req.body, ['language']);
    if (validationError) {
      throw validationError;
    }

    const user = await updateUserLanguage(userId!, language);

    sendSuccessResponse(res, { user }, 'Language updated successfully');
  }
);

/**
 * Update user currency
 * @route PATCH /api/v1/user/currency
 */
export const updateCurrency = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const { currency } = req.body;

    const validationError = validateRequiredFields(req.body, ['currency']);
    if (validationError) {
      throw validationError;
    }

    const user = await updateUserCurrency(userId!, currency);

    sendSuccessResponse(res, { user }, 'Currency updated successfully');
  }
);

// =================================
// EMAIL & PHONE UPDATE CONTROLLERS
// =================================

/**
 * Request email change (send OTP)
 * @route POST /api/v1/user/email/request-change
 */
export const requestEmailUpdate = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const { newEmail } = req.body;

    const validationError = validateRequiredFields(req.body, ['newEmail']);
    if (validationError) {
      throw validationError;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      throw new ValidationError('Invalid email format');
    }

    await requestEmailChange(userId!, newEmail);

    sendSuccessResponse(
      res,
      null,
      'OTP sent to new email. Please verify to complete change.'
    );
  }
);

/**
 * Verify email change with OTP
 * @route POST /api/v1/user/email/verify-change
 */
export const verifyEmailUpdate = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const { newEmail, otp } = req.body;

    const validationError = validateRequiredFields(req.body, [
      'newEmail',
      'otp',
    ]);
    if (validationError) {
      throw validationError;
    }

    await verifyAndUpdateEmail(userId!, newEmail, otp);

    sendSuccessResponse(res, null, 'Email updated successfully');
  }
);

/**
 * Request phone change (send OTP)
 * @route POST /api/v1/user/phone/request-change
 */
export const requestPhoneUpdate = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const { newPhone } = req.body;

    const validationError = validateRequiredFields(req.body, ['newPhone']);
    if (validationError) {
      throw validationError;
    }

    // Basic phone validation (E.164 format)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(newPhone)) {
      throw new ValidationError(
        'Invalid phone format. Use E.164 format (e.g., +1234567890)'
      );
    }

    await requestPhoneChange(userId!, newPhone);

    sendSuccessResponse(
      res,
      null,
      'OTP sent to new phone number. Please verify to complete change.'
    );
  }
);

/**
 * Verify phone change with OTP
 * @route POST /api/v1/user/phone/verify-change
 */
export const verifyPhoneUpdate = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const { newPhone, otp } = req.body;

    const validationError = validateRequiredFields(req.body, [
      'newPhone',
      'otp',
    ]);
    if (validationError) {
      throw validationError;
    }

    await verifyAndUpdatePhone(userId!, newPhone, otp);

    sendSuccessResponse(res, null, 'Phone number updated successfully');
  }
);

// =================================
// PASSWORD CONTROLLER
// =================================

/**
 * Change password
 * @route POST /api/v1/user/password
 */
export const changePassword = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const { oldPassword, newPassword, confirmPassword } = req.body;

    const validationError = validateRequiredFields(req.body, [
      'oldPassword',
      'newPassword',
      'confirmPassword',
    ]);
    if (validationError) {
      throw validationError;
    }

    // Validate password match
    if (newPassword !== confirmPassword) {
      throw new ValidationError('New passwords do not match');
    }

    // Validate password strength (min 8 characters)
    if (newPassword.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long');
    }

    await changeUserPassword(userId!, oldPassword, newPassword);

    sendSuccessResponse(res, null, 'Password changed successfully');
  }
);

// =================================
// SUBSCRIPTION CONTROLLER
// =================================

// /**
//  * Get user subscription
//  * @route GET /api/v1/user/subscription
//  */
// export const getSubscription = asyncHandler(
//   async (req: Request, res: Response): Promise<void> => {
//     const userId = req.user?.id;

//     // Get subscription from database
//     const subscription = await prisma.subscription.findUnique({
//       where: { userId: userId! },
//       //   include: {
//       //     receipts: {
//       //       select: {
//       //         id: true,
//       //         platform: true,
//       //         receiptData: true,
//       //         status: true,
//       //         createdAt: true,
//       //       },
//       //     },
//       //   },
//     });

//     if (!subscription) {
//       // User is on free plan
//       sendSuccessResponse(
//         res,
//         {
//           subscription: {
//             plan: 'FREE',
//             status: 'ACTIVE',
//             isActive: true,
//             receiptsRemaining: null, // Unlimited for free users
//           },
//         },
//         'Subscription fetched successfully'
//       );
//       return;
//     }

//     sendSuccessResponse(
//       res,
//       { subscription },
//       'Subscription fetched successfully'
//     );
//   }
// );

// =================================
// ACCOUNT DELETION CONTROLLER
// =================================

/**
 * Delete user account
 * @route DELETE /api/v1/user/account
 */
export const deleteAccount = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const { reasons, feedback } = req.body;

    const validationError = validateRequiredFields(req.body, ['reasons']);
    if (validationError) {
      throw validationError;
    }

    // Validate reasons is an array with at least one reason
    if (!Array.isArray(reasons) || reasons.length === 0) {
      throw new ValidationError(
        'Please provide at least one reason for account deletion'
      );
    }

    // Verify password before deletion
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true, provider: true },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // // For SSO users, skip password check
    // if (!user.provider) {
    //   const isValidPassword = await bcrypt.compare(password, user.password);
    //   if (!isValidPassword) {
    //     throw new UnauthorizedError('Incorrect password');
    //   }
    // }

    // Get request metadata
    const userAgent = req.get('User-Agent') || undefined;
    const ipAddress = req.ip || req.connection.remoteAddress || undefined;

    // Delete account permanently with feedback
    await deleteUserAccount(userId!, reasons, feedback, userAgent, ipAddress);

    sendSuccessResponse(
      res,
      null,
      "Account deleted successfully. We're sorry to see you go!"
    );
  }
);

// Import prisma for subscription check
import prisma from '@packages/libs/prisma';
