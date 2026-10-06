import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Clean up stale rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);

export const createRateLimiter = (options: {
  windowMs: number;
  maxRequests: number;
  message?: string;
}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown-ip';
    const key = `${req.baseUrl || ''}${req.path}:${ip}`;
    const now = Date.now();

    const record = rateLimitStore.get(key);

    if (!record || now > record.resetTime) {
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + options.windowMs,
      });
      res.setHeader('X-RateLimit-Limit', options.maxRequests);
      res.setHeader('X-RateLimit-Remaining', options.maxRequests - 1);
      next();
      return;
    }

    if (record.count >= options.maxRequests) {
      const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      res.status(429).json({
        error: 'Too Many Requests',
        message: options.message || 'Too many requests. Please try again later.',
        retryAfterSeconds,
      });
      return;
    }

    record.count++;
    res.setHeader('X-RateLimit-Limit', options.maxRequests);
    res.setHeader('X-RateLimit-Remaining', options.maxRequests - record.count);
    next();
  };
};

// Rate Limiters
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 mins
  maxRequests: 25,
  message: 'Too many login attempts. Please wait 15 minutes before trying again.',
});

export const importerRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 mins
  maxRequests: 30,
  message: 'Importer rate limit reached. Please wait before scanning collections again.',
});

export const generalApiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 min
  maxRequests: 120,
  message: 'API rate limit reached. Please slow down your requests.',
});
