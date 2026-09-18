import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { notFound } from '../lib/errors.js';
import { toSession, toUser } from '../lib/mappers.js';
import { requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { doctorInsight } from '../services/gemini.js';
import * as sessions from '../services/sessions.js';
import * as users from '../services/users.js';
import { carePlanSchema } from './schemas.js';

export const doctorRouter = Router();

doctorRouter.use(requireRole('doctor', 'admin'));

// every /patients/:id route is limited to the doctor's own patients
doctorRouter.param('id', (req, _res, next, id: string) => {
  users
    .canViewUser(req.auth, id)
    .then((ok) => next(ok ? undefined : notFound('Patient not found')))
    .catch(next);
});

doctorRouter.get(
  '/patients',
  asyncHandler(async (req, res) => {
    const rows = await users.listPatients(req.auth.role === 'doctor' ? req.auth.id : undefined);
    res.json(rows.map((r) => ({ ...toUser(r), sessionCount: r.session_count, avgScore: r.avg_score ?? 0 })));
  })
);

doctorRouter.get(
  '/patients/:id/sessions',
  asyncHandler(async (req, res) => {
    res.json((await sessions.listSessionsForUser(req.params.id)).map(toSession));
  })
);

doctorRouter.put(
  '/patients/:id/care-plan',
  validateBody(carePlanSchema),
  asyncHandler(async (req, res) => {
    if (!(await users.setCarePlan(req.params.id, req.body.carePlan))) throw notFound('Patient not found');
    res.json({ carePlan: req.body.carePlan });
  })
);

doctorRouter.post(
  '/patients/:id/insight',
  asyncHandler(async (req, res) => {
    const patient = await users.findUserById(req.params.id);
    if (!patient) throw notFound('Patient not found');
    const recent = await sessions.listSessionsForUser(patient.user_id, 5);
    res.json({ insight: await doctorInsight(patient, recent) });
  })
);
