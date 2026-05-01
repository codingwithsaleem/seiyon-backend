import { Response, Request } from 'express';
import {
  ValidationError,
  ConflictError,
  UnauthorizedError,
  NotFoundError,
} from '../../packages/error-handaler/index';
import {
  asyncHandler,
  sendSuccessResponse,
  validateRequiredFields,
  // checkResourceExists,
  handleDatabaseOperation,
} from '../../packages/error-handaler/error-middleware';
import {
  // SSO helpers
  validateSSOProvider,
  checkSSOUserExists,
  // findSSOUser,
  createSSOUser,
  updateUserLoginInfo,
  SSOProvider,
  SSOUserData,
  verifyGoogleIdToken,
  verifyAppleIdToken,
  verifyFirebaseIdToken,
  createSSOSession,
} from '../../packages/utils/helpers/auth.helper';
import { UserStatus } from '@prisma/client';
import { ssoRegisterSchema } from '@packages/libs/database/validators/auth.validators';
import prisma from '@packages/libs/prisma';
import crypto from 'crypto';
import logger from '../utils/logger';
import { createSession } from '../../packages/utils/helpers/session.helper';

// =================================
// SSO AUTHENTICATION CONTROLLERS
// =================================

// Generic SSO Register Function
const handleSSORegister = async (
  req: Request,
  res: Response,
  provider: SSOProvider,
  user: SSOUserData
) => {
  const {
    providerId,
    email,
    fullName,
    firstName,
    lastName,
    avatar,
    accessToken,
    refreshToken,
  } = user;

  if (!validateSSOProvider(provider)) {
    throw new ValidationError('Invalid SSO provider');
  }

  // Check if user already exists
  const { exists } = await handleDatabaseOperation(
    () => checkSSOUserExists(email, providerId, provider),
    'checking SSO user existence'
  );

  if (exists) {
    throw new ConflictError('User already exists. Please sign in.');
  }

  // Create new SSO user
  const userData: SSOUserData = {
    providerId,
    email,
    fullName,
    firstName,
    lastName,
    avatar,
    accessToken,
    refreshToken,
  };

  const newUser = await handleDatabaseOperation(
    () => createSSOUser(userData, provider),
    'creating SSO user'
  );

  // Create session and generate tokens
  const responseData = await createSSOSession(newUser, req);

  sendSuccessResponse(
    res,
    responseData,
    `${provider.charAt(0).toUpperCase() + provider.slice(1)} registration successful`,
    201
  );
};

const handleSSOLogin = async (
  req: Request,
  res: Response,
  provider: SSOProvider,
  data: SSOUserData
) => {
  const { email } = data;

  if (!validateSSOProvider(provider)) {
    throw new ValidationError('Invalid SSO provider');
  }

  // Validate required fields
  validateRequiredFields({ email }, ['email']);

  // check if email is present
  if (!email) {
    throw new ValidationError('Email is required for SSO login');
  }

  // Find existing user
  const user = await handleDatabaseOperation(
    () => prisma.user.findUnique({ where: { email } }),
    'finding SSO user'
  );

  // Check if user exists
  if (!user) {
    throw new NotFoundError('No account found. Please sign up first.');
  }

  // Check if user account is active
  if (user.status !== UserStatus.ACTIVE) {
    throw new UnauthorizedError(
      'Account is not active. Please contact support.'
    );
  }

  // Update login info
  await handleDatabaseOperation(
    () => updateUserLoginInfo(user.id),
    'updating login info'
  );

  // Create session and generate tokens
  const responseData = await createSSOSession(user, req);

  sendSuccessResponse(
    res,
    responseData,
    `${provider.charAt(0).toUpperCase() + provider.slice(1)} login successful`,
    200
  );
};

export const handleAppleRegister = async (
  req: Request,
  res: Response,
  data: {
    email?: string;
    providerId: string;
    isPrivateEmail?: boolean;
    emailVerified?: boolean;
    fullName?: string;
    firstName?: string;
    lastName?: string;
  }
) => {
  const { email, providerId, fullName, firstName, lastName } = data;

  // Check if user already exists by providerId (NOT email)
  const existingUser = await handleDatabaseOperation(
    () =>
      prisma.user.findFirst({
        where: {
          provider: 'apple',
          providerId,
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          firstName: true,
          lastName: true,
          avatar: true,
          role: true,
          status: true,
          provider: true,
          providerId: true,
          isEmailVerified: true,
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
    'checking existing Apple user'
  );

  if (existingUser) {
    throw new ConflictError(
      'User already exists with this Apple account. Please sign in.'
    );
  }

  // Generate a fallback email if Apple doesn't provide one
  const userEmail = email || `${providerId}@privaterelay.appleid.com`;

  // Create new user
  const userData: SSOUserData = {
    providerId,
    email: userEmail,
    fullName: fullName || userEmail.split('@')[0],
    firstName,
    lastName,
    avatar: undefined,
  };

  const newUser = await handleDatabaseOperation(
    () =>
      prisma.user.create({
        data: {
          email: userEmail,
          provider: 'apple',
          providerId,
          fullName: userData.fullName,
          firstName: userData.firstName,
          lastName: userData.lastName,
          password: crypto.randomBytes(32).toString('hex'),
          role: 'USER',
          status: 'ACTIVE',
          isEmailVerified: Boolean(email), // True only if Apple provided real email
          emailVerified: Boolean(email),
          metadata: {
            isPrivateEmail: data.isPrivateEmail,
            appleEmailVerified: data.emailVerified,
          },
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          firstName: true,
          lastName: true,
          avatar: true,
          role: true,
          status: true,
          provider: true,
          providerId: true,
          isEmailVerified: true,
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
    'creating Apple SSO user'
  );

  // Create default notification preferences for new SSO user
  // await createDefaultNotificationPreferences(newUser.id);

  // Create FREE subscription for the new SSO user
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
  //   'creating FREE subscription for Apple SSO user'
  // );

  // Create session and generate tokens
  const responseData = await createSSOSession(newUser, req);

  sendSuccessResponse(res, responseData, 'Apple registration successful', 201);
};

export const handleAppleLogin = async (
  req: Request,
  res: Response,
  data: {
    providerId: string;
  }
) => {
  // Find user by providerId (PRIMARY KEY for Apple)
  const user = await handleDatabaseOperation(
    () =>
      prisma.user.findFirst({
        where: {
          provider: 'apple',
          providerId: data.providerId,
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          firstName: true,
          lastName: true,
          avatar: true,
          role: true,
          status: true,
          provider: true,
          providerId: true,
          isEmailVerified: true,
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
          lastLoginAt: true,
          createdAt: true,
        },
      }),
    'finding Apple SSO user'
  );

  if (!user) {
    throw new NotFoundError(
      'No account found with this Apple ID. Please sign up first.'
    );
  }

  // Check if user account is active
  if (user.status !== UserStatus.ACTIVE) {
    throw new UnauthorizedError(
      'Account is not active. Please contact support.'
    );
  }

  // Update login info
  await handleDatabaseOperation(
    () => updateUserLoginInfo(user.id),
    'updating login info'
  );

  // Create session and generate tokens
  const responseData = await createSSOSession(user, req);

  sendSuccessResponse(res, responseData, 'Apple login successful', 200);
};

export const googleRegister = asyncHandler(
  async (req: Request, res: Response) => {
    const validatedData = ssoRegisterSchema.safeParse(req.body);
    if (!validatedData.success) {
      throw new ValidationError(
        'Invalid user registration data===',
        validatedData.error.errors.map(err => err.message)
      );
    }
    const { idToken } = validatedData.data;
    // Verify the Google ID token
    const userData = await verifyGoogleIdToken(idToken);
    await handleSSORegister(req, res, 'google', userData);
  }
);

export const appleRegister = asyncHandler(
  async (req: Request, res: Response) => {
    const validatedData = ssoRegisterSchema.safeParse(req.body);
    if (!validatedData.success) {
      throw new ValidationError(
        'Invalid user registration data',
        validatedData.error.errors.map(err => err.message)
      );
    }
    const { idToken, user: userInfo } = validatedData.data;

    // Verify the Apple ID token with optional user info
    const userData = await verifyAppleIdToken(idToken, userInfo);

    // Register the user and return session
    await handleAppleRegister(req, res, userData);
  }
);

// SSO Login Controllers
export const googleLogin = asyncHandler(async (req: Request, res: Response) => {
  const { idToken } = req.body;
  if (!idToken) {
    throw new ValidationError('Google ID token is required');
  }
  // Verify the Google ID token
  const userData = await verifyGoogleIdToken(idToken);
  await handleSSOLogin(req, res, 'google', userData);
});

export const appleLogin = asyncHandler(async (req: Request, res: Response) => {
  const { idToken } = req.body;
  if (!idToken) {
    throw new ValidationError('Apple ID token is required');
  }

  // Verify the Apple ID token
  const userData = await verifyAppleIdToken(idToken);

  // Login and return session
  await handleAppleLogin(req, res, {
    providerId: userData.providerId,
  });
});

// =================================
// FIREBASE SSO CONTROLLER
// =================================

/**
 * Firebase SSO Login/Register
 * Single endpoint for both Google & Apple via Firebase
 * Benefits:
 * - No Apple Client ID needed
 * - Hidden/private emails handled automatically
 * - Works cross-platform (iOS, Android, Web)
 * - Simplified token verification
 */
export const firebaseSSOLogin = asyncHandler(
  async (req: Request, res: Response) => {
    const { idToken } = req.body;

    if (!idToken) {
      throw new ValidationError('Firebase ID token is required');
    }

    // Verify Firebase token (handles both Google & Apple)
    const firebaseData = await verifyFirebaseIdToken(idToken);

    const { uid, email, displayName, photoURL, provider, emailVerified } =
      firebaseData;

    if (!email) {
      throw new ValidationError('Email is required for Firebase SSO');
    }

    // Simple: Check if user exists by email
    let user = await handleDatabaseOperation(
      () =>
        prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            fullName: true,
            firstName: true,
            lastName: true,
            avatar: true,
            role: true,
            status: true,
            provider: true,
            providerId: true,
            isEmailVerified: true,
            phoneVerified: true,
            phone: true,
            age: true,
            gender: true,
            language: true,
            preferredCurrency: true,
            metadata: true,
            lastLoginAt: true,
            createdAt: true,
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
      'checking user by email'
    );

    // If user doesn't exist, create new user
    if (!user) {
      user = await handleDatabaseOperation(
        () =>
          prisma.user.create({
            data: {
              email,
              provider: `firebase-${provider}`,
              providerId: uid,
              fullName: displayName || email.split('@')[0],
              avatar: photoURL,
              password: crypto.randomBytes(32).toString('hex'),
              role: 'USER',
              status: 'ACTIVE',
              isEmailVerified: emailVerified,
              emailVerified: emailVerified,
              countyId: '6a02a461-2cc9-4542-99b8-64b83faad71f', // Default county (Beaufort) - can be updated by user later
            },
            select: {
              id: true,
              email: true,
              fullName: true,
              firstName: true,
              lastName: true,
              avatar: true,
              role: true,
              status: true,
              provider: true,
              providerId: true,
              isEmailVerified: true,
              phoneVerified: true,
              phone: true,
              age: true,
              gender: true,
              language: true,
              preferredCurrency: true,
              metadata: true,
              lastLoginAt: true,
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
              createdAt: true,
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
        'creating Firebase SSO user'
      );

      // Create default notification preferences for new Firebase SSO user
      // await createDefaultNotificationPreferences(user!.id);

      // Create FREE subscription for new user
      // await handleDatabaseOperation(
      //   () =>
      //     prisma.subscription.create({
      //       data: {
      //         userId: user!.id,
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

      logger.info('New Firebase user registered', { userId: user.id, email });
    }

    // Ensure user exists (should never be null here)
    if (!user) {
      throw new Error('Failed to retrieve user after creation');
    }

    // Check if user account is active
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedError(
        'Account is not active. Please contact support.'
      );
    }

    // Update login info
    await handleDatabaseOperation(
      () => updateUserLoginInfo(user!.id),
      'updating login info'
    );

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

    // Prepare response data (exact format as regular login)
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
      `Firebase ${provider} login successful`,
      200
    );
  }
);
