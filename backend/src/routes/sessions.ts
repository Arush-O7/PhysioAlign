import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { badRequest, notFound } from '../lib/errors.js';
import { toSession } from '../lib/mappers.js';
import { validateBody } from '../middleware/validate.js';
import { enqueueCritique } from '../services/critiqueQueue.js';
import * as sessions from '../services/sessions.js';
import * as users from '../services/users.js';
import { sessionSchema } from './schemas.js';

export const sessionsRouter = Router();

// saves right away and returns 202. the critique is generated in the background
// and the client polls GET /sessions/:id until critiqueStatus is 'ready'
sessionsRouter.post(
  '/',
  validateBody(sessionSchema),
  asyncHandler(async (req, res) => {
    if (!req.auth.user) throw badRequest('Finish setting up your profile first');
    if (await sessions.findSession(req.body.id)) throw badRequest('Session already saved');

    const row = await sessions.createSession(req.auth.id, req.body);
    enqueueCritique(row.id);
    res.status(202).json(toSession(row));
  })
);

sessionsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const row = await sessions.findSession(req.params.id);
    // 404 rather than 403 so other people's session ids can't be probed
    if (!row || !(await users.canViewUser(req.auth, row.user_id))) throw notFound('Session not found');
    res.json(toSession(row));
  })
);

sessionsRouter.post(
  '/:id/critique/retry',
  asyncHandler(async (req, res) => {
    const row = await sessions.findSession(req.params.id);
    if (!row || row.user_id !== req.auth.id) throw notFound('Session not found');
    if (row.critique_status !== 'failed') throw badRequest('Only failed critiques can be retried');

    await sessions.resetCritique(row.id);
    enqueueCritique(row.id);
    res.status(202).json({ ...toSession(row), critiqueStatus: 'pending' });
  })
);

sessionsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const deleted = await sessions.deleteSession(req.params.id, req.auth.role === 'admin' ? undefined : req.auth.id);
    if (!deleted) throw notFound('Session not found');
    res.status(204).end();
  })
);
