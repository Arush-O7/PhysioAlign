import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { badRequest, forbidden, unauthorized } from '../lib/errors.js';
import { toUser } from '../lib/mappers.js';
import { clearSessionCookie, setSessionCookie } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { verifyGoogleCredential } from '../services/google.js';
import { hashPassword, needsRehash, verifyPassword } from '../services/passwords.js';
import * as users from '../services/users.js';
import { googleSchema, loginSchema, signupSchema } from './schemas.js';

export const authRouter = Router();

authRouter.post(
  '/signup',
  validateBody(signupSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password, role } = req.body;
    if (role === 'admin' && !(await users.canSelfAssignAdmin(email))) {
      throw forbidden('Admin accounts have to be created by an existing admin');
    }
    if (await users.findUserByEmail(email)) throw badRequest('Email already registered');

    const user = await users.createEmailUser({ name, email, passwordHash: hashPassword(password), role });
    setSessionCookie(req, res, user.user_id);
    res.status(201).json({ user: toUser(user) });
  })
);

authRouter.post(
  '/login',
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await users.findUserByEmail(email);
    if (!user?.password_hash || !verifyPassword(password, user.password_hash)) {
      throw unauthorized('Invalid email or password');
    }
    // upgrade old low-iteration hashes now that we have the plain password
    if (needsRehash(user.password_hash)) await users.updatePasswordHash(user.user_id, hashPassword(password));

    setSessionCookie(req, res, user.user_id);
    res.json({ user: toUser(user) });
  })
);

authRouter.post(
  '/google',
  validateBody(googleSchema),
  asyncHandler(async (req, res) => {
    const profile = await verifyGoogleCredential(req.body.credential);
    if (!profile) throw unauthorized('Google sign-in could not be verified');

    setSessionCookie(req, res, profile.id, profile.email);
    res.json({ user: profile });
  })
);

authRouter.post('/logout', (_req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});
