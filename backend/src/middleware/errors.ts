import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../lib/errors.js';
import { isConnectionError } from '../db/pool.js';

export const DB_UNAVAILABLE = "Can't reach the database right now. Please try again in a minute.";

// express needs all four args to treat this as an error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err instanceof ZodError) {
    const issue = err.issues[0];
    return res.status(400).json({ error: `${issue.path.join('.') || 'body'}: ${issue.message}` });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body is too large' });
  }
  if (isConnectionError(err)) {
    console.error(`[api] ${req.method} ${req.path}: database unreachable:`, err.message);
    return res.status(503).json({ error: DB_UNAVAILABLE });
  }
  console.error(`[api] ${req.method} ${req.path} failed:`, err);
  res.status(500).json({ error: 'Something went wrong' });
}
