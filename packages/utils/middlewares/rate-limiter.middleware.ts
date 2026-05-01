import { Request, Response, NextFunction } from 'express';

// Simple in-memory rate limiter (use Redis for production)
const callCounts = new Map<string, { count: number; resetAt: Date }>();

/**
 * Rate limiter middleware to enforce daily API call limits
 * Prevents exceeding Google Cloud budget by limiting receipt scans
 */
export const apiRateLimiter = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const key = `api:calls:${today}`;
    const limit = parseInt(process.env.DAILY_API_CALL_LIMIT || '249');

    // Get or initialize counter for today
    let data = callCounts.get(key);

    if (!data) {
      // Initialize new day
      data = {
        count: 0,
        resetAt: new Date(Date.now() + 86400000), // 24 hours from now
      };
      callCounts.set(key, data);

      // Clean up old entries
      callCounts.forEach((value, oldKey) => {
        if (value.resetAt < new Date()) {
          callCounts.delete(oldKey);
        }
      });
    }

    // Increment counter
    data.count += 1;

    // Check if limit exceeded
    if (data.count > limit) {
      return res.status(429).json({
        success: false,
        error: 'Daily API limit exceeded',
        message: `You have reached the daily limit of ${limit} receipt scans. Please try again tomorrow.`,
        retryAfter: data.resetAt.toISOString(),
        limit,
        remaining: 0,
      });
    }

    // Add headers for client awareness
    res.setHeader('X-RateLimit-Limit', limit.toString());
    res.setHeader('X-RateLimit-Remaining', (limit - data.count).toString());
    res.setHeader('X-RateLimit-Reset', data.resetAt.toISOString());

    next();
  } catch (error) {
    console.error('Rate limiter error:', error);
    next(); // Allow request on error (fail open)
  }
};

/**
 * Get current API usage statistics
 * Useful for admin dashboards
 */
export const getApiUsageStats = () => {
  const today = new Date().toISOString().split('T')[0];
  const key = `api:calls:${today}`;
  const data = callCounts.get(key);
  const limit = parseInt(process.env.DAILY_API_CALL_LIMIT || '249');

  return {
    date: today,
    callsUsed: data?.count || 0,
    limit,
    remaining: limit - (data?.count || 0),
    resetAt: data?.resetAt || new Date(Date.now() + 86400000),
    percentageUsed: ((data?.count || 0) / limit) * 100,
  };
};
