import { Response, Request } from 'express';
import {
  ValidationError,
  ConflictError,
  OTPExpiredError,
  OTPInvalidError,
  OTPAttemptsExceededError,
  UnauthorizedError,
  InvalidCredentialsError,
  NotFoundError,
} from '../../packages/error-handaler/index';
import {
  asyncHandler,
  sendSuccessResponse,
  validateRequiredFields,
  // checkResourceExists,
  handleDatabaseOperation,
} from '../../packages/error-handaler/error-middleware';
import prisma from '../../packages/libs/prisma';
import {
  checkOtpRestriction,
  // sendOtpEmail,
  sendOtpToEmailAndPhone,
  verifyOtp,
  cleanupOtp,
} from '../../packages/utils/helpers/auth.helper';
import {
  createSession,
  invalidateSession,
  getSessionByRefreshToken,
  updateSessionTokens,
  invalidateAllUserSessions,
} from '../../packages/utils/helpers/session.helper';
import {
  verifyRefreshToken,
  generateTokenPair,
} from '../../packages/utils/helpers/jwt.helper';
import bcrypt from 'bcryptjs';
import {
  UserRegisterSchema,
  verifyUserSchema,
  loginSchema,
  forgotPasswordSchema,
  verifyForgotPasswordSchema,
  resetPasswordSchema,
  resendOtpSchema,
} from '@packages/libs/database/validators/auth.validators';
import { UserStatus, OtpType } from '@prisma/client';
import logger from '../utils/logger';

//register a new user
export const userRegister = asyncHandler(
  async (req: Request, res: Response) => {
    const validatedData = UserRegisterSchema.safeParse(req.body);
    if (!validatedData.success) {
      throw new ValidationError(
        'Invalid user registration data',
        validatedData.error.errors.map(err => err.message)
      );
    }

    const { fullName, email, phoneNumber, password, age, gender, countyId } =
      validatedData.data;

    // Check if user already exists
    const existingUser = await handleDatabaseOperation(
      () =>
        prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            username: true,
            status: true,
            isEmailVerified: true,
          },
        }),
      'checking existing user'
    );

    // If user exists and is ACTIVE/verified, don't allow re-registration
    if (
      existingUser &&
      existingUser.status === UserStatus.ACTIVE &&
      existingUser.isEmailVerified
    ) {
      throw new ConflictError(
        'User already exists with this email. Please login instead.'
      );
    }

    // If user exists but is INACTIVE/unverified, allow re-registration
    if (
      existingUser &&
      (!existingUser.isEmailVerified ||
        existingUser.status === UserStatus.INACTIVE)
    ) {
      // Clean up old OTP if exists
      await handleDatabaseOperation(
        () => prisma.otpVerification.deleteMany({ where: { email } }),
        'cleaning up old OTP'
      );

      // Check OTP restrictions
      const restrictionCheck = await checkOtpRestriction(email);
      if (!restrictionCheck.allowed) {
        throw new OTPAttemptsExceededError(restrictionCheck.message!);
      }

      // Send new OTP
      const otpResult = await sendOtpToEmailAndPhone(
        email,
        phoneNumber || existingUser.username,
        'verifyEmailOtpTemplate',
        OtpType.EMAIL_VERIFICATION
      );

      // Update user with new details if provided
      const hashedPassword = await bcrypt.hash(password, 10);
      await handleDatabaseOperation(
        () =>
          prisma.user.update({
            where: { email },
            data: {
              fullName: fullName,
              phone: phoneNumber,
              password: hashedPassword,
              age: age,
              gender: gender,
              countyId: countyId, // Update user's primary county
              status: UserStatus.INACTIVE, // Keep inactive until verified
              isEmailVerified: false,
            },
          }),
        'updating unverified user'
      );

      return sendSuccessResponse(
        res,
        null,
        'Registration details updated. ' + otpResult.message,
        200
      );
    }

    //Check UserName availability (only for new users)
    // const existingUserName = await handleDatabaseOperation(
    //   () =>
    //     prisma.user.findUnique({
    //       where: { username },
    //       select: { id: true, email: true, username: true },
    //     }),
    //   'checking existing username'
    // );
    // if (existingUserName) {
    //   throw new ConflictError(
    //     'Username is already taken. Please choose a different one.'
    //   );
    // }

    // Check if phone number is already in use (only for new users)
    if (phoneNumber) {
      const existingPhone = await handleDatabaseOperation(
        () =>
          prisma.user.findUnique({
            where: { phone: phoneNumber },
            select: { id: true, phone: true },
          }),
        'checking existing phone number'
      );
      if (existingPhone) {
        throw new ConflictError('Phone number is already registered');
      }
    }

    // Check OTP restrictions
    const restrictionCheck = await checkOtpRestriction(email);
    if (!restrictionCheck.allowed) {
      throw new OTPAttemptsExceededError(restrictionCheck.message!);
    }

    // Send OTP to both email and phone
    const otpResult = await sendOtpToEmailAndPhone(
      email,
      phoneNumber,
      'verifyEmailOtpTemplate',
      OtpType.EMAIL_VERIFICATION
    );

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the new user with INACTIVE status
    const newUser = await handleDatabaseOperation(
      () =>
        prisma.user.create({
          data: {
            email,
            fullName: fullName,
            phone: phoneNumber,
            password: hashedPassword,
            age: age,
            gender: gender,
            countyId: countyId, // Set user's primary county
            status: UserStatus.INACTIVE, // User must verify email first
            isEmailVerified: false,
            // role: role as unknown as UserRole,
          },
        }),
      'creating user'
    );
    if (!newUser) {
      throw new ConflictError('Failed to create user');
    }

    // Create default notification preferences for new user
    // await createDefaultNotificationPreferences(newUser.id);

    // If countyId is provided, automatically follow that county
    if (countyId) {
      try {
        await handleDatabaseOperation(
          () =>
            prisma.userCounty.create({
              data: {
                userId: newUser.id,
                countyId: countyId,
                notificationsEnabled: true,
                isActive: true,
              },
            }),
          'following county during registration'
        );

        // Increment follower count for the county
        await handleDatabaseOperation(
          () =>
            prisma.county.update({
              where: { id: countyId },
              data: {
                followerCount: {
                  increment: 1,
                },
              },
            }),
          'updating county follower count'
        );
      } catch (error) {
        // Don't fail registration if county follow fails
        logger.warn(`Failed to follow county during registration: ${error}`);
      }
    }

    // // Create FREE subscription for the new user
    // await handleDatabaseOperation(
    //   () =>
    //     prisma.subscription.create({
    //       data: {
    //         userId: newUser.id,
    //         plan: 'FREE',
    //         status: 'ACTIVE',
    //         scanLimit: 10,
    //         currentMonthScans: 0,
    //         hasBudgetAccess: false,
    //         saveRecipientData: false,
    //         startDate: new Date(),
    //       },
    //     }),
    //   'creating FREE subscription'
    // );

    sendSuccessResponse(res, null, otpResult.message, 200);
  }
);

export const verifyUserRegistration = asyncHandler(
  async (req: Request, res: Response) => {
    const validated = verifyUserSchema.safeParse(req.body);

    if (!validated.success) {
      throw new ValidationError('Invalid input', validated.error.errors);
    }
    const { email, otp } = validated.data;

    // Check if the user exists
    const existingUser = await handleDatabaseOperation(
      () => prisma.user.findUnique({ where: { email } }),
      'checking existing user'
    );
    if (!existingUser) {
      throw new UnauthorizedError('User not found');
    }

    // Verify the OTP
    const otpResult = await verifyOtp(email, otp);
    if (!otpResult.valid) {
      if (otpResult.message.includes('expired')) {
        throw new OTPExpiredError(otpResult.message);
      } else {
        throw new OTPInvalidError(otpResult.message);
      }
    }

    // Update user  to make active
    const updatedUser = await handleDatabaseOperation(
      () =>
        prisma.user.update({
          where: { email },
          data: {
            status: UserStatus.ACTIVE,
            emailVerified: true,
            isEmailVerified: true,
          },
          select: {
            id: true,
            email: true,
            fullName: true,
            phone: true,
            status: true,
            role: true,
            isEmailVerified: true,
            phoneVerified: true,
            language: true,
            preferredCurrency: true,
            metadata: true,
            age: true,
            gender: true,
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
            createdAt: true,
          },
        }),
      'updating user status'
    );
    if (!updatedUser) {
      throw new ConflictError('Failed to update user status');
    }

    // Clean up OTP record
    await cleanupOtp(email);

    // Get request metadata
    const userAgent = req.get('User-Agent') || '';
    const ipAddress = req.ip || req.connection.remoteAddress || '';
    const platform = (req.headers['x-platform'] as string) || 'web';
    const deviceInfo = (req.headers['user-agent'] as string) || '';
    const location = (req.headers['x-location'] as string) || '';

    // Create new session and generate tokens (auto-login after verification)
    const { session, tokens } = await createSession(
      updatedUser.id,
      updatedUser.email,
      userAgent,
      ipAddress,
      platform,
      deviceInfo,
      location
    );

    // Prepare user data for response
    const userData = {
      id: updatedUser.id,
      email: updatedUser.email,
      fullName: updatedUser.fullName,
      status: updatedUser.status,
      role: updatedUser.role,
      phone: updatedUser.phone,
      phoneVerified: updatedUser.phoneVerified,
      isEmailVerified: updatedUser.isEmailVerified,
      metadata: updatedUser.metadata,
      preferredCurrency: updatedUser.preferredCurrency,
      age: updatedUser.age,
      gender: updatedUser.gender,
      countyId: updatedUser.countyId,
      county: updatedUser.county,
      counties: updatedUser.userCounties.map(uc => ({
        id: uc.county.id,
        name: uc.county.name,
        state: uc.county.state,
        slug: uc.county.slug,
        coverImage: uc.county.coverImage,
        notificationsEnabled: uc.notificationsEnabled,
        followedAt: uc.followedAt,
      })),
      createdAt: updatedUser.createdAt,
    };

    // Prepare response data with session and tokens
    const responseData = {
      user: userData,
      session: {
        id: session.id,
        expiresAt: session.expiresAt,
        deviceInfo: session?.deviceInfo,
        ipAddress: session?.ipAddress,
        userAgent: session?.userAgent,
        platform: session?.platform,
      },
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        accessTokenExpiresAt: tokens.accessTokenExpiresAt,
        refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
      },
    };

    sendSuccessResponse(
      res,
      responseData,
      'User registered and logged in successfully',
      201
    );
  }
);

export const userLogin = asyncHandler(async (req: Request, res: Response) => {
  const validated = loginSchema.safeParse(req.body);
  if (!validated.success) {
    throw new ValidationError('Invalid login data', validated.error.errors);
  }
  const { email, password } = validated.data;

  // Find user by email
  const user = await handleDatabaseOperation(
    () =>
      prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          password: true,
          fullName: true,
          phone: true,
          status: true,
          createdAt: true,
          role: true,
          isEmailVerified: true,
          phoneVerified: true,
          language: true,
          metadata: true,
          preferredCurrency: true,
          age: true,
          gender: true,
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
      }),
    'finding user for login'
  );
  if (!user) {
    throw new NotFoundError('User not found with this email');
  }
  // Check if user account is active
  if (user.status !== UserStatus.ACTIVE) {
    throw new UnauthorizedError(
      'Account is not active. Please contact support.'
    );
  }
  // Check if email is verified
  if (!user.isEmailVerified) {
    throw new UnauthorizedError(
      'Email is not verified. Please verify your email.'
    );
  }
  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new InvalidCredentialsError('Invalid email or password');
  }
  // Get request metadata
  const userAgent = req.get('User-Agent') || '';
  const ipAddress = req.ip || req.connection.remoteAddress || '';
  const platform = (req.headers['x-platform'] as string) || 'web';
  const deviceInfo = (req.headers['user-agent'] as string) || '';
  const location = (req.headers['x-location'] as string) || '';
  // Create new session and generate tokens
  const { session, tokens } = await createSession(
    user.id,
    user.email,
    userAgent,
    ipAddress,
    platform,
    deviceInfo,
    location
  );
  // Prepare user data for response (exclude password)
  const userData = {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    status: user.status,
    role: user.role,
    phone: user.phone,
    phoneVerified: user.phoneVerified,
    isEmailVerified: user.isEmailVerified,
    language: user.language,
    preferredCurrency: user.preferredCurrency,
    metadata: user.metadata,
    age: user.age,
    gender: user.gender,
    countyId: user.countyId,
    county: user.county,
    counties: user.userCounties.map(uc => ({
      id: uc.county.id,
      name: uc.county.name,
      state: uc.county.state,
      slug: uc.county.slug,
      coverImage: uc.county.coverImage,
      notificationsEnabled: uc.notificationsEnabled,
      followedAt: uc.followedAt,
    })),
    createdAt: user.createdAt,
  };
  // Prepare response data
  const responseData = {
    user: userData,
    session: {
      id: session.id,
      expiresAt: session.expiresAt,
      deviceInfo: session?.deviceInfo,
      ipAddress: session?.ipAddress,
      userAgent: session?.userAgent,
      platform: session?.platform,
    },
    tokens: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
    },
  };
  sendSuccessResponse(res, responseData, 'Login successful', 200);
});

// Request Forgot password (send OTP)
export const forgotPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const validated = forgotPasswordSchema.safeParse(req.body);
    if (!validated.success) {
      throw new ValidationError(
        'Invalid input format',
        validated.error.errors.map(err => err.message)
      );
    }
    const { email, phoneNumber } = validated.data;

    // Find user by email or phone
    const user = await handleDatabaseOperation(
      () =>
        prisma.user.findFirst({
          where: {
            OR: [
              email ? { email } : {},
              phoneNumber ? { phone: phoneNumber } : {},
            ].filter(condition => Object.keys(condition).length > 0),
          },
        }),
      'checking user for forgot password'
    );

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    // Use user's email for OTP record (required field)
    const userEmail = user.email;

    // Check OTP restrictions
    const restrictionCheck = await checkOtpRestriction(userEmail);

    if (!restrictionCheck.allowed) {
      throw new OTPAttemptsExceededError(restrictionCheck.message!);
    }

    // Send OTP to both email and phone
    const otpResult = await sendOtpToEmailAndPhone(
      userEmail,
      user.phone,
      'forgotPasswordOtpTemplate',
      OtpType.PASSWORD_RESET
    );
    if (!otpResult.success) {
      throw new Error('Failed to send OTP');
    }

    sendSuccessResponse(res, null, otpResult.message, 200);
  }
);

// Verify forgot password OTP
export const verifyForgotPasswordOtp = asyncHandler(
  async (req: Request, res: Response) => {
    const validated = verifyForgotPasswordSchema.safeParse(req.body);
    if (!validated.success) {
      throw new ValidationError(
        'Invalid email or OTP format',
        validated.error.errors.map(err => err.message)
      );
    }
    const { email, phoneNumber, otp } = validated.data;

    // Check if user exists by email or phone
    const user = await handleDatabaseOperation(
      () =>
        prisma.user.findFirst({
          where: {
            OR: [
              email ? { email } : {},
              phoneNumber ? { phone: phoneNumber } : {},
            ].filter(condition => Object.keys(condition).length > 0),
          },
        }),
      'checking user for forgot password OTP verification'
    );
    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    // Use user's email for OTP verification
    const userEmail = user.email;

    // Verify the OTP
    const otpResult = await verifyOtp(userEmail, otp);
    if (!otpResult.valid) {
      if (otpResult.message.includes('expired')) {
        throw new OTPExpiredError(otpResult.message);
      } else {
        throw new OTPInvalidError(otpResult.message);
      }
    }

    sendSuccessResponse(res, null, 'OTP verified successfully', 200);
  }
);

// Reset password
export const resetPassword = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const validated = resetPasswordSchema.safeParse(req.body);
      if (!validated.success) {
        throw new ValidationError(
          'Invalid email or password format',
          validated.error.errors.map(err => err.message)
        );
      }
      const { email, newPassword } = validated.data;

      // Check if user exists
      const user = await handleDatabaseOperation(
        () => prisma.user.findUnique({ where: { email } }),
        'checking user for password reset'
      );

      if (!user) {
        throw new UnauthorizedError('User not found');
      }

      // Verify the OTP
      const otpResult = await verifyOtp(email, 'resetPasswordOtp');

      if (!otpResult.valid) {
        if (otpResult.message.includes('expired')) {
          throw new OTPExpiredError(otpResult.message);
        } else {
          throw new OTPInvalidError(otpResult.message);
        }
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update the user's password
      const updatedUser = await handleDatabaseOperation(
        () =>
          prisma.user.update({
            where: { email },
            data: { password: hashedPassword },
          }),
        'updating user password'
      );

      if (!updatedUser) {
        throw new UnauthorizedError('Failed to update password');
      }

      // Clean up OTP record
      await cleanupOtp(email);

      // Invalidate all sessions for the user
      await invalidateAllUserSessions(updatedUser.id);

      sendSuccessResponse(res, null, 'Password reset successfully', 200);
    } catch (error) {
      logger.error('Error in resetPassword:', error);
      if (
        error instanceof ValidationError ||
        error instanceof OTPExpiredError ||
        error instanceof OTPInvalidError
      ) {
        throw error; // Re-throw validation and OTP errors
      }
      throw new Error('Failed to reset password');
    }
  }
);

// Refresh token
export const refreshToken = asyncHandler(
  async (req: Request, res: Response) => {
    const { refreshToken: clientRefreshToken } = req.body;

    // Validate required fields
    const requiredFieldError = validateRequiredFields(req.body, [
      'refreshToken',
    ]);
    if (requiredFieldError) {
      throw requiredFieldError;
    }

    // Verify the refresh token
    const tokenPayload = verifyRefreshToken(clientRefreshToken);

    // Find session by refresh token
    const session = await getSessionByRefreshToken(clientRefreshToken);
    if (!session) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    // Verify session belongs to the token
    if (session.id !== tokenPayload.sessionId) {
      throw new UnauthorizedError('Token session mismatch');
    }

    // Get user data
    const user = await handleDatabaseOperation(
      () =>
        prisma.user.findUnique({
          where: { id: session.userId },
          select: {
            id: true,
            email: true,
            fullName: true,
            status: true,
          },
        }),
      'finding user for token refresh'
    );

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedError('Account is not active');
    }

    // Generate new token pair
    const newTokens = generateTokenPair(user.id, user.email, session.id);

    // Update session with new tokens
    const updatedSession = await updateSessionTokens(session.id, newTokens);

    // Prepare response
    const responseData = {
      tokens: {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        accessTokenExpiresAt: newTokens.accessTokenExpiresAt,
        refreshTokenExpiresAt: newTokens.refreshTokenExpiresAt,
      },
      session: {
        id: updatedSession.id,
        expiresAt: updatedSession.expiresAt,
      },
    };

    sendSuccessResponse(res, responseData, 'Token refreshed successfully', 200);
  }
);

// User logout
export const userLogout = asyncHandler(async (req: Request, res: Response) => {
  // Get session ID from authenticated request (will be set by auth middleware)
  const sessionId = (req as Request & { sessionId?: string }).sessionId;

  if (!sessionId) {
    throw new UnauthorizedError('No active session found');
  }

  // Invalidate the session
  await invalidateSession(sessionId);

  sendSuccessResponse(res, null, 'Logged out successfully', 200);
});

// Resend verification OTP
export const resendVerificationOtp = asyncHandler(
  async (req: Request, res: Response) => {
    const validated = resendOtpSchema.safeParse(req.body);
    if (!validated.success) {
      throw new ValidationError('Invalid request data', {
        details: validated.error.flatten().fieldErrors,
      });
    }

    const { email, phoneNumber, type } = validated.data;

    // Find user by email or phone
    const existingUser = await handleDatabaseOperation(
      () =>
        prisma.user.findFirst({
          where: {
            OR: [
              email ? { email } : {},
              phoneNumber ? { phone: phoneNumber } : {},
            ].filter(condition => Object.keys(condition).length > 0),
          },
        }),
      'checking existing user'
    );

    if (!existingUser) {
      throw new NotFoundError('User not found');
    }

    // Use user's email for OTP restriction check
    const userEmail = existingUser.email;

    // Check OTP restrictions
    const restrictionCheck = await checkOtpRestriction(userEmail);
    if (!restrictionCheck.allowed) {
      throw new OTPAttemptsExceededError(restrictionCheck.message!);
    }

    let emailTemplate: string;

    if (type === OtpType.EMAIL_VERIFICATION) {
      emailTemplate = 'verifyEmailOtpTemplate';
    } else if (type === OtpType.PASSWORD_RESET) {
      emailTemplate = 'forgotPasswordOtpTemplate';
    } else {
      throw new ValidationError('Invalid OTP type for resend.');
    }

    // Send OTP to both email and phone
    const otpResult = await sendOtpToEmailAndPhone(
      userEmail,
      existingUser.phone,
      emailTemplate,
      type
    );
    if (!otpResult.success) {
      throw new Error(`Failed to send ${type} OTP`);
    }

    const message =
      type === OtpType.EMAIL_VERIFICATION
        ? 'Verification OTP sent successfully'
        : 'Password reset OTP sent successfully';

    sendSuccessResponse(res, null, otpResult.message || message, 200);
  }
);
