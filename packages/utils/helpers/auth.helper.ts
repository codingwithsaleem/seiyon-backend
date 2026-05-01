import axios from 'axios';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import admin from '../../../src/config/firebase';
import { ValidationError } from '../../../packages/error-handaler';
import prisma from '../../../packages/libs/prisma';
// import { sendOtpSMS, sendForgotPasswordOtpSMS } from './sms.helper';
import { OtpType, UserRole, UserStatus, Gender } from '@prisma/client';
import logger from '../../../src/utils/logger';
import { Request } from 'express';
import { createSession } from './session.helper';
import { sendEmailSMTP } from '../email-templates/smtp.email.service';

// check otp restriction - returns boolean instead of calling next
export const checkOtpRestriction = async (
  email: string
): Promise<{ allowed: boolean; message?: string }> => {
  try {
    const otpVerification = await prisma.otpVerification.findUnique({
      where: { email },
    });

    if (otpVerification?.otpCooldown) {
      const cooldownTime = new Date(otpVerification.otpCooldown);
      const currentTime = new Date();

      if (currentTime < cooldownTime) {
        const remainingTime = Math.ceil(
          (cooldownTime.getTime() - currentTime.getTime()) / 1000
        );
        return {
          allowed: false,
          message: `You can request a new OTP in ${remainingTime} seconds`,
        };
      }
    }

    if (otpVerification?.otpLockedUntil) {
      const lockedUntil = new Date(otpVerification.otpLockedUntil);
      const currentTime = new Date();

      if (currentTime < lockedUntil) {
        const remainingLockTime = Math.ceil(
          (lockedUntil.getTime() - currentTime.getTime()) / 60000
        );
        return {
          allowed: false,
          message: `Account is locked due to too many failed OTP attempts! Try again after ${remainingLockTime} minutes`,
        };
      }
    }

    return { allowed: true };
  } catch (error) {
    logger.error('Error checking OTP restriction:', error);
    throw new Error('Failed to check OTP restriction');
  }
};

// send otp to both email and phone
export const sendOtpToEmailAndPhone = async (
  email: string,
  phoneNumber: string | null | undefined,
  templateName: string,
  type: OtpType
): Promise<{ success: boolean; message: string }> => {
  try {
    const newOtp = crypto.randomInt(10000, 99999).toString(); // Generate a 5-digit OTP
    const expireAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Save OTP to database using upsert to handle existing records
    await prisma.otpVerification.upsert({
      where: { email },
      update: {
        otp: newOtp,
        expiresAt: expireAt,
        attemptCount: 0,
        verified: false,
        otpCooldown: new Date(Date.now() + 60 * 1000), // 1 minute cooldown
      },
      create: {
        email,
        otp: newOtp,
        type: type,
        expiresAt: expireAt,
        attemptCount: 0,
        verified: false,
        otpCooldown: new Date(Date.now() + 60 * 1000),
      },
    });

    // Send OTP to email
    // await sendEmail(
    //   email,
    //   'Your OTP Code',
    //   `Your OTP code is: ${newOtp}. It is valid for 5 minutes.`,
    //   templateName,
    //   {
    //     otp: newOtp,
    //     expiresAt: expireAt.toISOString(),
    //     email: email,
    //   }
    // );

    await sendEmailSMTP(
      email,
      'Your OTP Code',
      `Your OTP code is: ${newOtp}. It is valid for 5 minutes.`,
      templateName,
      {
        otp: newOtp,
        expiresAt: expireAt.toISOString(),
        email: email,
      }
    );

    // Send OTP to phone if phone number is provided
    if (phoneNumber) {
      if (type === OtpType.PASSWORD_RESET) {
        // await sendForgotPasswordOtpSMS(phoneNumber, newOtp);
      } else {
        // await sendOtpSMS(phoneNumber, newOtp);
      }
    }

    const sentTo = phoneNumber ? 'email and phone' : 'email';
    return { success: true, message: `OTP sent successfully to ${sentTo}` };
  } catch (error) {
    logger.error('Error sending OTP:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new ValidationError('Failed to send OTP', {
      details: { error: errorMessage },
    });
  }
};

// Backward compatibility - send otp email only
export const sendOtpEmail = async (
  email: string,
  templateName: string,
  type: OtpType
): Promise<{ success: boolean; message: string }> => {
  return sendOtpToEmailAndPhone(email, null, templateName, type);
};

// verify otp - returns boolean result
export const verifyOtp = async (
  email: string,
  otp: string
): Promise<{ valid: boolean; message: string }> => {
  try {
    const otpVerification = await prisma.otpVerification.findUnique({
      where: { email },
    });

    if (!otpVerification) {
      return { valid: false, message: 'No OTP found for this email' };
    }

    if (otpVerification.expiresAt < new Date()) {
      // Clean up expired OTP
      await prisma.otpVerification.delete({ where: { email } });
      return { valid: false, message: 'OTP has expired' };
    }

    if (otp === 'resetPasswordOtp' && otpVerification.verified) {
      return {
        valid: true,
        message: 'OTP verified successfully for password reset',
      };
    }

    if (otp === 'resetPasswordOtp' && !otpVerification.verified) {
      return {
        valid: false,
        message: 'OTP is not verified for password reset',
      };
    }

    if (otpVerification.otp !== otp) {
      // Increment attempt count
      const newAttemptCount = otpVerification.attemptCount + 1;

      if (newAttemptCount >= 5) {
        // Lock the account and delete OTP
        await prisma.otpVerification.delete({ where: { email } });
        return {
          valid: false,
          message: 'Too many failed attempts. Please request a new OTP',
        };
      }

      await prisma.otpVerification.update({
        where: { email },
        data: { attemptCount: newAttemptCount },
      });

      return {
        valid: false,
        message: `Invalid OTP. ${5 - newAttemptCount} attempts remaining`,
      };
    }

    // OTP is valid - mark as verified but keep record for registration
    await prisma.otpVerification.update({
      where: { email },
      data: { verified: true },
    });

    return { valid: true, message: 'OTP verified successfully' };
  } catch (error) {
    logger.error('Error verifying OTP:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new ValidationError('Failed to verify OTP', {
      details: { error: errorMessage },
    });
  }
};

// Clean up OTP after successful registration
export const cleanupOtp = async (email: string): Promise<void> => {
  try {
    await prisma.otpVerification.delete({
      where: { email },
    });
  } catch (error) {
    logger.error('Error cleaning up OTP:', error);
  }
};

// SSO Helper Functions

// SSO Provider types
export type SSOProvider = 'google' | 'linkedin' | 'apple';

// SSO User Data interface
export interface SSOUserData {
  providerId: string;
  email: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  accessToken?: string;
  refreshToken?: string;
}

// SSO User Response interface
export interface SSOUserResponse {
  id: string;
  email: string;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  avatar: string | null;
  role: UserRole;
  status: UserStatus;
  provider: string | null;
  providerId: string | null;
  isEmailVerified: boolean;
  age?: number | null;
  gender?: Gender | null;
  countyId?: string | null;
  county?: {
    id: string;
    name: string;
    state: string;
    slug: string;
    coverImage: string | null;
  } | null;
  userCounties?: Array<{
    county: {
      id: string;
      name: string;
      state: string;
      slug: string;
      coverImage: string | null;
    };
    notificationsEnabled: boolean;
    followedAt: Date;
  }>;
  createdAt?: Date;
  lastLoginAt?: Date | null;
}

// Validate SSO provider
export const validateSSOProvider = (
  provider: string
): provider is SSOProvider => {
  return ['google', 'linkedin', 'apple'].includes(provider);
};

// Check if SSO user already exists (for registration)
export const checkSSOUserExists = async (
  email: string,
  providerId: string,
  provider: SSOProvider
): Promise<{ exists: boolean; user?: SSOUserResponse }> => {
  try {
    // Check by email and provider combination
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email, provider },
          { providerId, provider },
        ],
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
      },
    });

    return {
      exists: !!existingUser,
      user: existingUser || undefined,
    };
  } catch (error) {
    logger.error('Error checking SSO user existence:', error);
    throw new Error('Failed to check user existence');
  }
};

// Find SSO user for login
export const findSSOUser = async (
  email: string,
  providerId: string,
  provider: SSOProvider
): Promise<SSOUserResponse | null> => {
  try {
    const user = await prisma.user.findFirst({
      where: {
        email,
        providerId,
        provider,
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
        lastLoginAt: true,
        createdAt: true,
      },
    });

    return user;
  } catch (error) {
    logger.error('Error finding SSO user:', error);
    throw new Error('Failed to find user');
  }
};

// Create SSO user
export const createSSOUser = async (
  userData: SSOUserData,
  provider: SSOProvider
): Promise<SSOUserResponse> => {
  try {
    // const ssoTokensData =
    //   userData.accessToken || userData.refreshToken
    //     ? {
    //       accessToken: userData.accessToken,
    //       refreshToken: userData.refreshToken,
    //       updatedAt: new Date().toISOString(),
    //     }
    //     : undefined;

    const newUser = await prisma.user.create({
      data: {
        email: userData.email,
        providerId: userData.providerId,
        provider,
        fullName:
          userData.fullName ||
          `${userData.firstName || ''} ${userData.lastName || ''}`.trim() ||
          userData.email.split('@')[0],
        firstName: userData.firstName,
        lastName: userData.lastName,
        avatar: userData.avatar,
        password: crypto.randomBytes(32).toString('hex'),
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        isEmailVerified: true,
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
      },
    });

    return newUser;
  } catch (error) {
    logger.error('Error creating SSO user:', error);
    throw new Error('Failed to create user');
  }
};

// Update user login info
export const updateUserLoginInfo = async (userId: string): Promise<void> => {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        lastLoginAt: new Date(),
        lastActiveAt: new Date(),
        loginCount: { increment: 1 },
      },
    });
  } catch (error) {
    logger.error('Error updating user login info:', error);
    throw new Error('Failed to update login info');
  }
};

// Create session and generate tokens for SSO user
export const createSSOSession = async (
  user: SSOUserResponse,
  req: Request
): Promise<{
  user: SSOUserResponse;
  tokens: {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresAt: Date;
    refreshTokenExpiresAt: Date;
  };
  session: {
    id: string;
    expiresAt: Date;
    deviceInfo: string | undefined;
    ipAddress: string | undefined;
    userAgent: string | undefined;
    platform: string | undefined;
  };
}> => {
  try {
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
    
    // Format user data with counties
    const userData = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar,
      role: user.role,
      status: user.status,
      provider: user.provider,
      providerId: user.providerId,
      isEmailVerified: user.isEmailVerified,
      age: user.age,
      gender: user.gender,
      countyId: user.countyId,
      county: user.county,
      counties: user.userCounties?.map(uc => ({
        id: uc.county.id,
        name: uc.county.name,
        state: uc.county.state,
        slug: uc.county.slug,
        coverImage: uc.county.coverImage,
        notificationsEnabled: uc.notificationsEnabled,
        followedAt: uc.followedAt,
      })) || [],
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
    
    return {
      user: userData,
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        accessTokenExpiresAt: tokens.accessTokenExpiresAt,
        refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
      },
      session: {
        id: session.id,
        expiresAt: session.expiresAt,
        deviceInfo: session.deviceInfo,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        platform: session.platform,
      },
    };
  } catch (error) {
    logger.error('Error creating SSO session:', error);
    throw new Error('Failed to create session');
  }
};

// Verify Google ID Token
export const verifyGoogleIdToken = async (
  idToken: string
): Promise<{
  email: string;
  sub: string;
  fullName?: string;
  given_name?: string;
  family_name?: string;
  avatar?: string;
  providerId: string;
}> => {
  try {
    // Google's tokeninfo endpoint
    const response = await axios.get(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
    );
    const data = response.data;
    // console.log("Google token data:", data);
    if (!data.email || !data.sub) {
      throw new Error('Invalid Google token payload');
    }
    return {
      email: data.email,
      sub: data.sub,
      fullName: data.name,
      given_name: data.given_name,
      family_name: data.family_name,
      avatar: data.picture,
      providerId: data.sub,
    };
  } catch (error) {
    throw new ValidationError('Invalid or expired Google ID token', {
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }
};

interface AppleTokenPayload {
  email?: string;
  sub: string;
  email_verified?: boolean | string;
  is_private_email?: boolean | string;
  aud?: string;
  iss?: string;
  exp?: number;
  iat?: number;
}

// Verify Apple ID Token
export const verifyAppleIdToken = async (
  idToken: string,
  userInfo?: { fullName?: { firstName?: string; lastName?: string } }
): Promise<{
  email?: string;
  providerId: string;
  isPrivateEmail?: boolean;
  emailVerified?: boolean;
  fullName?: string;
  firstName?: string;
  lastName?: string;
}> => {
  try {
    const client = jwksClient({
      jwksUri: 'https://appleid.apple.com/auth/keys',
      cache: true,
      cacheMaxAge: 86400000,
      rateLimit: true,
      jwksRequestsPerMinute: 10,
    });

    const decodedHeader = jwt.decode(idToken, { complete: true });

    if (!decodedHeader || typeof decodedHeader === 'string') {
      throw new ValidationError('Invalid Apple ID token format');
    }

    const kid = decodedHeader.header.kid;
    if (!kid) {
      throw new ValidationError('Missing kid in Apple ID token');
    }

    const key = await client.getSigningKey(kid);
    const publicKey = key.getPublicKey();

    const decoded = jwt.verify(idToken, publicKey, {
      algorithms: ['RS256'],
      issuer: 'https://appleid.apple.com',
      audience: process.env.APPLE_CLIENT_ID,
    }) as AppleTokenPayload;

    if (!decoded.sub) {
      throw new ValidationError('Apple ID token missing sub');
    }

    const emailVerified =
      typeof decoded.email_verified === 'string'
        ? decoded.email_verified === 'true'
        : decoded.email_verified;

    const isPrivateEmail =
      typeof decoded.is_private_email === 'string'
        ? decoded.is_private_email === 'true'
        : decoded.is_private_email;

    // Extract fullName from userInfo (sent separately on first auth)
    let fullName: string | undefined;
    let firstName: string | undefined;
    let lastName: string | undefined;

    if (userInfo?.fullName) {
      firstName = userInfo.fullName.firstName;
      lastName = userInfo.fullName.lastName;
      fullName = [firstName, lastName].filter(Boolean).join(' ');
    }

    return {
      email: decoded.email, // may be undefined (Apple behavior)
      providerId: decoded.sub,
      emailVerified,
      isPrivateEmail,
      fullName,
      firstName,
      lastName,
    };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new ValidationError('Apple ID token expired');
    }

    if (error instanceof jwt.JsonWebTokenError) {
      throw new ValidationError('Invalid Apple ID token');
    }

    logger.error('Apple token verification failed', error);
    throw new ValidationError('Failed to verify Apple ID token');
  }
};

// =================================
// FIREBASE SSO VERIFICATION
// =================================

/**
 * Verify Firebase ID Token (handles both Google & Apple)
 * Firebase automatically validates provider and returns user info
 */
export const verifyFirebaseIdToken = async (
  idToken: string
): Promise<{
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  providerId: string;
  provider: 'google' | 'apple';
  emailVerified: boolean;
  isAnonymous: boolean;
}> => {
  try {
    // Verify the Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    // Extract provider information
    const firebaseProvider = decodedToken.firebase.sign_in_provider;
    let provider: 'google' | 'apple';

    if (firebaseProvider === 'google.com') {
      provider = 'google';
    } else if (firebaseProvider === 'apple.com') {
      provider = 'apple';
    } else {
      throw new ValidationError(
        `Unsupported Firebase provider: ${firebaseProvider}`
      );
    }

    // Get full user details from Firebase
    const userRecord = await admin.auth().getUser(decodedToken.uid);

    logger.info('Firebase token verified successfully', {
      uid: decodedToken.uid,
      provider,
      email: decodedToken.email,
    });

    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      displayName: userRecord.displayName || undefined,
      photoURL: userRecord.photoURL || undefined,
      providerId: decodedToken.uid, // Firebase UID is the unique identifier
      provider,
      emailVerified: decodedToken.email_verified || false,
      isAnonymous: userRecord.providerData.length === 0,
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }

    logger.error('Firebase token verification failed:', error);

    if (error && typeof error === 'object' && 'code' in error) {
      const firebaseError = error as { code: string; message: string };

      if (firebaseError.code === 'auth/id-token-expired') {
        throw new ValidationError('Firebase ID token has expired');
      }

      if (firebaseError.code === 'auth/id-token-revoked') {
        throw new ValidationError('Firebase ID token has been revoked');
      }

      if (firebaseError.code === 'auth/invalid-id-token') {
        throw new ValidationError('Invalid Firebase ID token');
      }

      if (firebaseError.code === 'auth/user-not-found') {
        throw new ValidationError('Firebase user not found');
      }
    }

    throw new ValidationError('Failed to verify Firebase ID token', {
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }
};
