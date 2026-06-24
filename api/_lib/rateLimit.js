/* eslint-env node */

/**
 * Simple in-memory rate limiter for serverless functions.
 * Note: In production with multiple instances, this will be per-instance.
 * For a production-grade solution, use Redis or Vercel KV.
 */
const rateLimitStore = new Map();

/**
 * Rate limiting middleware
 * @param {Object} options - Rate limiting options
 * @param {number} [options.windowMs=60000] - Time window in milliseconds (default: 1 minute)
 * @param {number} [options.max=60] - Maximum number of requests per window
 * @param {string} [options.message='Too many requests'] - Error message
 * @param {Function} [options.keyGenerator] - Function to generate the rate limit key
 * @returns {Function} Express/Vercel middleware function
 */
export function rateLimit(options = {}) {
  const {
    windowMs = 60 * 1000,
    max = 60,
    message = 'Too many requests, please try again later',
    keyGenerator = defaultKeyGenerator,
  } = options;

  return (req, res) => {
    const key = keyGenerator(req);
    const now = Date.now();

    let record = rateLimitStore.get(key);
    if (!record || now - record.windowStart > windowMs) {
      record = { windowStart: now, count: 0 };
      rateLimitStore.set(key, record);
    }

    record.count += 1;

    const remaining = Math.max(0, max - record.count);
    const resetTime = record.windowStart + windowMs;

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(resetTime / 1000)));

    if (record.count > max) {
      return { blocked: true, message, retryAfter: Math.ceil((resetTime - now) / 1000) };
    }

    return { blocked: false };
  };
}

/**
 * Default key generator: uses IP + endpoint path
 * @param {import('http').IncomingMessage} req - The request object
 * @returns {string} The rate limit key
 */
function defaultKeyGenerator(req) {
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const path = req.url || '/';
  return `${ip}:${path}`;
}

/**
 * Cleanup old entries from the rate limit store
 * Called periodically to prevent memory leaks
 */
export function cleanupRateLimitStore() {
  const now = Date.now();
  const maxWindow = 60 * 1000; // 1 minute

  for (const [key, record] of rateLimitStore.entries()) {
    if (now - record.windowStart > maxWindow) {
      rateLimitStore.delete(key);
    }
  }
}

// Auto-cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupRateLimitStore, 5 * 60 * 1000);
}

// --- Pre-configured rate limiters ---

/** General API rate limiter: 60 requests per minute */
export const apiLimiter = rateLimit({ windowMs: 60000, max: 60 });

/** Auth endpoints: 10 requests per minute */
export const authLimiter = rateLimit({ windowMs: 60000, max: 10 });

/** Email endpoint: 5 requests per minute (expensive operation) */
export const emailLimiter = rateLimit({ windowMs: 60000, max: 5 });

/** Push notification endpoint: 30 requests per minute */
export const pushLimiter = rateLimit({ windowMs: 60000, max: 30 });

/** Table operations: 30 requests per minute */
export const tableLimiter = rateLimit({ windowMs: 60000, max: 30 });
