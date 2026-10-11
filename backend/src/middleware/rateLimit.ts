import type { NextFunction, Request, Response } from 'express';

interface Entry {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  /** what to count by. defaults to the client ip */
  key?: (req: Request) => string;
  message?: string;
  /** don't count requests that succeeded (used for login attempts) */
  skipSuccessful?: boolean;
}

/**
 * Fixed-window limiter kept in memory. Render runs a single instance, so this
 * is enough; behind more than one instance it would need a shared store.
 * Sends the standard RateLimit-* headers so clients can back off politely.
 */
export function rateLimit({ windowMs, max, key, message, skipSuccessful }: RateLimitOptions) {
  const hits = new Map<string, Entry>();

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [k, entry] of hits) if (entry.resetAt <= now) hits.delete(k);
  }, windowMs);
  sweep.unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const id = key ? key(req) : (req.ip ?? 'unknown');

    let entry = hits.get(id);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(id, entry);
    }

    const resetSeconds = Math.ceil((entry.resetAt - now) / 1000);
    res.set('RateLimit-Limit', String(max));
    res.set('RateLimit-Reset', String(resetSeconds));

    if (entry.count >= max) {
      res.set('RateLimit-Remaining', '0');
      res.set('Retry-After', String(resetSeconds));
      return res.status(429).json({
        error: message || 'Too many requests. Please wait a moment and try again.',
        retryAfterSeconds: resetSeconds,
      });
    }

    entry.count++;
    res.set('RateLimit-Remaining', String(Math.max(0, max - entry.count)));

    if (skipSuccessful) {
      // give the attempt back when it worked, so normal use never trips the limit
      res.on('finish', () => {
        if (res.statusCode < 400 && entry!.count > 0) entry!.count--;
      });
    }

    next();
  };
}

/** limiter keyed by the signed-in user, falling back to ip before sign-in */
export const byUser = (req: Request) => req.auth?.id || req.ip || 'unknown';
