import prisma from '../../libs/prisma';
import { generateSessionId, generateTokenPair, TokenPair } from './jwt.helper';
import { DatabaseError, NotFoundError } from '../../error-handaler/index';

export interface SessionData {
  id: string;
  userId: string;
  token: string;
  refreshToken: string | null;
  expiresAt: Date;
  createdAt: Date;
  userAgent?: string;
  ipAddress?: string;
  platform?: string;
  deviceInfo?: string;
  location?: string;
}

/**
 * Create a new session for user login
 */
export const createSession = async (
  userId: string,
  email: string,
  userAgent?: string,
  ipAddress?: string,
  platform?: string,
  deviceInfo?: string,
  location?: string
): Promise<{ session: SessionData; tokens: TokenPair }> => {
  try {
    const sessionId = generateSessionId();
    const tokens = generateTokenPair(userId, email, sessionId);

    const session = await prisma.session.create({
      data: {
        id: sessionId,
        userId,
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.refreshTokenExpiresAt, // Use refresh token expiry as session expiry
        createdAt: new Date(),
        userAgent,
        ipAddress,
        platform,
        deviceInfo,
        location,
      },
    });

    // Map nullable fields to undefined if null to satisfy SessionData type
    const sessionData: SessionData = {
      id: session.id,
      userId: session.userId,
      token: session.token,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      userAgent: session.userAgent ?? undefined,
      ipAddress: session.ipAddress ?? undefined,
      platform: session.platform ?? undefined,
      deviceInfo: session.deviceInfo ?? undefined,
      location: session.location ?? undefined,
    };

    return { session: sessionData, tokens };
  } catch (error) {
    throw new DatabaseError('Failed to create session', {
      userId,
      error: (error as Error).message,
    });
  }
};

/**
 * Get session by ID
 */
export const getSessionById = async (
  sessionId: string
): Promise<SessionData | null> => {
  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });
    if (!session) return null;
    const sessionData: SessionData = {
      id: session.id,
      userId: session.userId,
      token: session.token,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      userAgent: session.userAgent ?? undefined,
      ipAddress: session.ipAddress ?? undefined,
      platform: session.platform ?? undefined,
      deviceInfo: session.deviceInfo ?? undefined,
      location: session.location ?? undefined,
    };
    return sessionData;
  } catch (error) {
    throw new DatabaseError('Failed to fetch session', {
      sessionId,
      error: (error as Error).message,
    });
  }
};

/**
 * Get active session by user ID (most recent valid session)
 */
export const getActiveSessionByUserId = async (
  userId: string
): Promise<SessionData | null> => {
  try {
    const session = await prisma.session.findFirst({
      where: {
        userId,
        expiresAt: {
          gt: new Date(), // Only get sessions that haven't expired
        },
      },
      orderBy: {
        createdAt: 'desc', // Get the most recent session
      },
    });
    if (!session) return null;
    const sessionData: SessionData = {
      id: session.id,
      userId: session.userId,
      token: session.token,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      userAgent: session.userAgent ?? undefined,
      ipAddress: session.ipAddress ?? undefined,
      platform: session.platform ?? undefined,
      deviceInfo: session.deviceInfo ?? undefined,
      location: session.location ?? undefined,
    };
    return sessionData;
  } catch (error) {
    throw new DatabaseError('Failed to fetch active session', {
      userId,
      error: (error as Error).message,
    });
  }
};

/**
 * Update session with new tokens
 */
export const updateSessionTokens = async (
  sessionId: string,
  tokens: TokenPair
): Promise<SessionData> => {
  try {
    const session = await prisma.session.update({
      where: { id: sessionId },
      data: {
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.refreshTokenExpiresAt,
      },
    });
    const sessionData: SessionData = {
      id: session.id,
      userId: session.userId,
      token: session.token,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      userAgent: session.userAgent ?? undefined,
      ipAddress: session.ipAddress ?? undefined,
      platform: session.platform ?? undefined,
      deviceInfo: session.deviceInfo ?? undefined,
      location: session.location ?? undefined,
    };
    return sessionData;
  } catch (error) {
    throw new DatabaseError('Failed to update session', {
      sessionId,
      error: (error as Error).message,
    });
  }
};

/**
 * Invalidate session (logout) - delete the session
 */
export const invalidateSession = async (sessionId: string): Promise<void> => {
  try {
    await prisma.session.delete({
      where: { id: sessionId },
    });
  } catch (error) {
    throw new DatabaseError('Failed to invalidate session', {
      sessionId,
      error: (error as Error).message,
    });
  }
};

/**
 * Invalidate all sessions for a user
 */
export const invalidateAllUserSessions = async (
  userId: string
): Promise<void> => {
  try {
    await prisma.session.deleteMany({
      where: { userId },
    });
  } catch (error) {
    throw new DatabaseError('Failed to invalidate user sessions', {
      userId,
      error: (error as Error).message,
    });
  }
};

/**
 * Clean up expired sessions (for periodic cleanup)
 */
export const cleanupExpiredSessions = async (): Promise<number> => {
  try {
    const result = await prisma.session.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    return result.count;
  } catch (error) {
    throw new DatabaseError('Failed to cleanup expired sessions', {
      error: (error as Error).message,
    });
  }
};

/**
 * Validate session and check if it's active and not expired
 */
export const validateSession = async (
  sessionId: string
): Promise<SessionData> => {
  const session = await getSessionById(sessionId);

  if (!session) {
    throw new NotFoundError('Session not found');
  }

  if (session.expiresAt <= new Date()) {
    // Automatically invalidate expired session
    await invalidateSession(sessionId);
    throw new NotFoundError('Session has expired');
  }

  return session;
};

/**
 * Get user sessions with pagination
 */
export const getUserSessions = async (
  userId: string,
  limit = 10,
  offset = 0
): Promise<{ sessions: SessionData[]; total: number }> => {
  try {
    const [sessions, total] = await Promise.all([
      prisma.session.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.session.count({
        where: { userId },
      }),
    ]);

    const sessionDataArray: SessionData[] = sessions.map(session => ({
      id: session.id,
      userId: session.userId,
      token: session.token,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      userAgent: session.userAgent ?? undefined,
      ipAddress: session.ipAddress ?? undefined,
      platform: session.platform ?? undefined,
      deviceInfo: session.deviceInfo ?? undefined,
      location: session.location ?? undefined,
    }));

    return { sessions: sessionDataArray, total };
  } catch (error) {
    throw new DatabaseError('Failed to fetch user sessions', {
      userId,
      error: (error as Error).message,
    });
  }
};

/**
 * Find session by refresh token
 */
export const getSessionByRefreshToken = async (
  refreshToken: string
): Promise<SessionData | null> => {
  try {
    const session = await prisma.session.findFirst({
      where: {
        refreshToken,
        expiresAt: {
          gt: new Date(),
        },
      },
    });
    if (!session) return null;

    return {
      id: session.id,
      userId: session.userId,
      token: session.token,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      userAgent: session.userAgent ?? undefined,
      ipAddress: session.ipAddress ?? undefined,
      platform: session.platform ?? undefined,
      deviceInfo: session.deviceInfo ?? undefined,
      location: session.location ?? undefined,
    };
  } catch (error) {
    throw new DatabaseError('Failed to fetch session by refresh token', {
      error: (error as Error).message,
    });
  }
};
