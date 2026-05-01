import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import {
  UnauthorizedError,
  TokenExpiredError,
  InvalidTokenError,
} from '../../error-handaler/index';

// JWT Configuration
const ACCESS_TOKEN_SECRET: string = process.env.ACCESS_TOKEN_SECRET as string;
const REFRESH_TOKEN_SECRET: string = process.env.REFRESH_TOKEN_SECRET as string;
const JWT_EXPIRES_IN: string = (process.env.JWT_EXPIRES_IN as string) || '7d';
const JWT_REFRESH_EXPIRES_IN: string =
  (process.env.JWT_REFRESH_EXPIRES_IN as string) || '30d';

export interface TokenPayload {
  userId: string;
  email: string;
  sessionId: string;
  type: 'access' | 'refresh';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}

/**
 * Generate access token
 */
export const generateAccessToken = (
  payload: Omit<TokenPayload, 'type'>
): string => {
  const tokenPayload = { ...payload, type: 'access' as const };

  const options: SignOptions = {
    expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    issuer: 'animal-adoption-portal',
    audience: 'animal-adoption-portal-users',
  };

  return jwt.sign(tokenPayload, ACCESS_TOKEN_SECRET, options);
};

/**
 * Generate refresh token
 */
export const generateRefreshToken = (
  payload: Omit<TokenPayload, 'type'>
): string => {
  const tokenPayload = { ...payload, type: 'refresh' as const };

  const options: SignOptions = {
    expiresIn: JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    issuer: 'animal-adoption-portal',
    audience: 'animal-adoption-portal-users',
  };

  return jwt.sign(tokenPayload, REFRESH_TOKEN_SECRET, options);
};

/**
 * Generate both access and refresh tokens
 */
export const generateTokenPair = (
  userId: string,
  email: string,
  sessionId: string
): TokenPair => {
  const payload = { userId, email, sessionId };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  // Calculate expiration times
  const accessTokenExpiresAt = new Date(
    Date.now() + parseExpirationTime(JWT_EXPIRES_IN)
  );
  const refreshTokenExpiresAt = new Date(
    Date.now() + parseExpirationTime(JWT_REFRESH_EXPIRES_IN)
  );

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt,
    refreshTokenExpiresAt,
  };
};

/**
 * Verify access token
 */
export const verifyAccessToken = (token: string): TokenPayload => {
  try {
    const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET, {
      issuer: 'animal-adoption-portal',
      audience: 'animal-adoption-portal-users',
    }) as TokenPayload;

    if (decoded.type !== 'access') {
      throw new InvalidTokenError('Invalid token type');
    }

    return decoded;
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      throw new TokenExpiredError('Access token has expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new InvalidTokenError('Invalid access token');
    } else if (error instanceof UnauthorizedError) {
      throw error;
    } else {
      throw new InvalidTokenError('Token verification failed');
    }
  }
};

/**
 * Verify refresh token
 */
export const verifyRefreshToken = (token: string): TokenPayload => {
  try {
    const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET, {
      issuer: 'animal-adoption-portal',
      audience: 'animal-adoption-portal-users',
    }) as TokenPayload;

    if (decoded.type !== 'refresh') {
      throw new InvalidTokenError('Invalid token type');
    }

    return decoded;
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      throw new TokenExpiredError('Refresh token has expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new InvalidTokenError('Invalid refresh token');
    } else if (error instanceof UnauthorizedError) {
      throw error;
    } else {
      throw new InvalidTokenError('Token verification failed');
    }
  }
};

/**
 * Generate a secure session ID
 */
export const generateSessionId = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Parse expiration time string to milliseconds
 */
const parseExpirationTime = (expiresIn: string): number => {
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid expiration time format: ${expiresIn}`);
  }

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Unknown time unit: ${unit}`);
  }
};

/**
 * Extract token from Authorization header
 */
export const extractTokenFromHeader = (
  authHeader: string | undefined
): string => {
  if (!authHeader) {
    throw new UnauthorizedError('Authorization header is missing');
  }

  if (!authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Invalid authorization header format');
  }

  const token = authHeader.substring(7);
  if (!token) {
    throw new UnauthorizedError('Token is missing');
  }

  return token;
};

/**
 * Check if token is about to expire (within 5 minutes)
 */
export const isTokenNearExpiry = (expiresAt: Date): boolean => {
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
  return expiresAt <= fiveMinutesFromNow;
};
