import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id: string;
      startedAt: number;
    }
  }
}

const SLOW_REQUEST_MS = 1500;

/**
 * Gives every request an id, echoes it back on the response, and logs one line
 * per API call. The id also goes into error responses so a user can quote it.
 */
export function requestContext(req: Request, res: Response, next: NextFunction) {
  req.id = (req.get('X-Request-Id') || crypto.randomUUID()).slice(0, 64);
  req.startedAt = Date.now();
  res.set('X-Request-Id', req.id);

  if (!config.isTest) {
    res.on('finish', () => {
      const duration = Date.now() - req.startedAt;
      const line = `${req.method} ${req.originalUrl.split('?')[0]} ${res.statusCode} ${duration}ms id=${req.id}`;
      if (res.statusCode >= 500 || duration > SLOW_REQUEST_MS) {
        console.warn(`[api] ${line}${duration > SLOW_REQUEST_MS ? ' SLOW' : ''}`);
      } else if (res.statusCode >= 400) {
        console.log(`[api] ${line}`);
      }
    });
  }

  next();
}
