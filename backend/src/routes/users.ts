import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { forbidden, notFound } from '../lib/errors.js';
import { toSession, toUser } from '../lib/mappers.js';
import { validateBody } from '../middleware/validate.js';
import { clearSessionCookie } from '../middleware/auth.js';
import * as sessions from '../services/sessions.js';
import * as users from '../services/users.js';
import { profileSchema } from './schemas.js';

export const usersRouter = Router();

// 404 means signed in but no profile yet (google users before onboarding)
usersRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    if (!req.auth.user) throw notFound('User profile not found');
    res.json(toUser(req.auth.user));
  })
);

usersRouter.put(
  '/me',
  validateBody(profileSchema),
  asyncHandler(async (req, res) => {
    const { role, ...profile } = req.body;
    if (req.auth.user) {
      return res.json(toUser(await users.updateProfile(req.auth.id, profile)));
    }
    if (role === 'admin' && !(await users.canSelfAssignAdmin(req.auth.email))) {
      throw forbidden('Admin accounts have to be created by an existing admin');
    }
    res.status(201).json(toUser(await users.createProfile(req.auth, { ...profile, role })));
  })
);

usersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!(await users.canViewUser(req.auth, req.params.id))) throw forbidden();
    const user = await users.findUserById(req.params.id);
    if (!user) throw notFound('User profile not found');
    res.json(toUser(user));
  })
);

// paginated so a long history doesn't ship hundreds of frame logs at once.
// ?limit=&offset= with a hard cap, and the total comes back in a header
usersRouter.get(
  '/:id/sessions',
  asyncHandler(async (req, res) => {
    if (!(await users.canViewUser(req.auth, req.params.id))) throw forbidden();

    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const [rows, total] = await Promise.all([
      sessions.listSessionsForUser(req.params.id, limit, offset),
      sessions.countSessionsForUser(req.params.id),
    ]);

    res.set('X-Total-Count', String(total));
    res.json(rows.map(toSession));
  })
);

// everything we hold about this account, as a file the user can keep
usersRouter.get(
  '/me/export',
  asyncHandler(async (req, res) => {
    if (!req.auth.user) throw notFound('User profile not found');
    const rows = await sessions.allSessionsForUser(req.auth.id);
    res.set('Content-Disposition', `attachment; filename="physioalign-data-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json({
      exportedAt: new Date().toISOString(),
      profile: toUser(req.auth.user),
      sessions: rows.map(toSession),
    });
  })
);

// self-service account deletion: profile and sessions go together
usersRouter.delete(
  '/me',
  asyncHandler(async (req, res) => {
    if (!req.auth.user) throw notFound('User profile not found');
    await users.deleteOwnAccount(req.auth.id);
    clearSessionCookie(res);
    res.status(204).end();
  })
);
