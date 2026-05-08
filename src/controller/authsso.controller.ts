import { Response, Request } from 'express';
import {
  ValidationError,
  UnauthorizedError,
} from '../../packages/error-handaler/index';
import {
  asyncHandler,
  sendSuccessResponse,
  // checkResourceExists,
  handleDatabaseOperation,
} from '../../packages/error-handaler/error-middleware';
import {
  // SSO helpers
  // findSSOUser,
  updateUserLoginInfo,
  verifyFirebaseIdToken,
} from '../../packages/utils/helpers/auth.helper';
import { UserStatus } from '@prisma/client';
import prisma from '@packages/libs/prisma';
import crypto from 'crypto';
import logger from '../utils/logger';
import { createSession } from '../../packages/utils/helpers/session.helper';


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
