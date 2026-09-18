import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny, z } from 'zod';

// replaces req.body with the parsed value, so handlers only ever see validated data
export const validateBody =
  <T extends ZodTypeAny>(schema: T) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) return next(result.error);
    req.body = result.data as z.infer<T>;
    next();
  };
