import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { forbidden, notFound } from '../lib/errors.js';
import { toSession, toUser } from '../lib/mappers.js';
import { validateBody } from '../middleware/validate.js';
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

usersRouter.get(
  '/:id/sessions',
  asyncHandler(async (req, res) => {
    if (!(await users.canViewUser(req.auth, req.params.id))) throw forbidden();
    res.json((await sessions.listSessionsForUser(req.params.id)).map(toSession));
  })
);
