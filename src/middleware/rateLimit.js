const AppError = require('../utils/AppError');
const { getRedis } = require('../config/redis');

const memoryBuckets = new Map();

function useMemoryBucket(key, windowSeconds, max) {
  const now = Date.now();
  const bucket = memoryBuckets.get(key);
  const active = !bucket || bucket.resetAt <= now ? { count: 0, resetAt: now + windowSeconds * 1000 } : bucket;
  active.count += 1;
  memoryBuckets.set(key, active);
  if (active.count > max) throw new AppError('Too many requests. Please try again shortly.', 429);
}

function rateLimit({ prefix, windowSeconds = 60, max = 30 }) {
  return async (req, res, next) => {
    const identifier = req.ip || 'unknown';
    const key = `${prefix}:${identifier}`;
    try {
      const redis = getRedis();
      if (redis) {
        const count = await redis.incr(key);
        if (count === 1) await redis.expire(key, windowSeconds);
        if (count > max) throw new AppError('Too many requests. Please try again shortly.', 429);
      } else useMemoryBucket(key, windowSeconds, max);
      next();
    } catch (error) {
      if (error.statusCode) return next(error);
      // Redis outages must not block collaboration; keep a conservative local bucket instead.
      try { useMemoryBucket(key, windowSeconds, max); next(); } catch (fallbackError) { next(fallbackError); }
    }
  };
}

module.exports = rateLimit;
