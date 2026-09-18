import type { NextFunction, Request, Response } from 'express';
import { createToken, TOKEN_TTL_SECONDS, verifyToken } from '../services/tokens.js';
import { findUserById } from '../services/users.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import type { AuthContext } from '../lib/types.js';

export const SESSION_COOKIE = 'pa_session';

// httpOnly so page scripts (and any xss) can't read the token
export function setSessionCookie(req: Request, res: Response, userId: string, email?: string | null) {
  res.cookie(SESSION_COOKIE, createToken(userId, email), {
    httpOnly: true,
    sameSite: 'lax',
    // req.secure is true behind render's https proxy because of trust proxy
    secure: req.secure,
    maxAge: TOKEN_TTL_SECONDS * 1000,
    path: '/',
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const data = verifyToken(req.cookies?.[SESSION_COOKIE]);
    if (!data) throw unauthorized();

    // role is read fresh on every request so admin changes apply straight away
    const user = (await findUserById(data.sub)) ?? null;
    const role: AuthContext['role'] =
      user?.role === 'doctor' && !user.approved ? 'pending_doctor' : user?.role ?? null;

    req.auth = { id: data.sub, email: user?.email ?? data.email ?? null, user, role };
    next();
  } catch (error) {
    next(error);
  }
}

export const requireRole =
  (...roles: string[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    next(req.auth && roles.includes(req.auth.role ?? '') ? undefined : forbidden());
  };

// cookies are sent automatically, so state-changing requests must carry a header
// that a cross-site form can't set. combined with SameSite=Lax this blocks csrf
export function requireCsrfHeader(req: Request, _res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('X-Requested-With') !== 'fetch') return next(forbidden('Missing X-Requested-With header'));
  next();
}
