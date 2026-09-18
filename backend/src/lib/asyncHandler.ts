import type { NextFunction, Request, RequestHandler, Response } from 'express';

// express 4 doesn't forward rejected promises to the error handler on its own
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
