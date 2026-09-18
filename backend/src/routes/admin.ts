import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { badRequest, notFound } from '../lib/errors.js';
import { toUser } from '../lib/mappers.js';
import { requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import * as users from '../services/users.js';
import { assignDoctorSchema, roleSchema } from './schemas.js';

export const adminRouter = Router();

adminRouter.use(requireRole('admin'));

adminRouter.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const s = await users.stats();
    res.json({
      totalUsers: s.users,
      patients: s.patients,
      doctors: s.doctors,
      sessions: s.sessions,
      dbEngine: 'PostgreSQL',
      dbSize: s.db_size,
      uptime: `${Math.round(process.uptime())}s`,
    });
  })
);

adminRouter.get(
  '/users',
  asyncHandler(async (_req, res) => {
    res.json((await users.listAllUsers()).map(toUser));
  })
);

adminRouter.put(
  '/users/:id/role',
  validateBody(roleSchema),
  asyncHandler(async (req, res) => {
    if (!(await users.setRole(req.params.id, req.body.role))) throw notFound('User not found');
    res.json({ role: req.body.role });
  })
);

adminRouter.post(
  '/users/:id/approve',
  asyncHandler(async (req, res) => {
    if (!(await users.approveDoctor(req.params.id))) throw notFound('Doctor not found');
    res.json({ approved: true });
  })
);

adminRouter.put(
  '/users/:id/doctor',
  validateBody(assignDoctorSchema),
  asyncHandler(async (req, res) => {
    const { doctorId } = req.body;
    if (doctorId && !(await users.isApprovedDoctor(doctorId))) throw badRequest('Pick an approved doctor');
    if (!(await users.assignDoctor(req.params.id, doctorId))) throw notFound('User not found');
    res.json({ doctorId });
  })
);

adminRouter.delete(
  '/users/:id',
  asyncHandler(async (req, res) => {
    if (req.params.id === req.auth.id) throw badRequest("You can't delete your own account");
    if (!(await users.deleteUser(req.params.id))) throw notFound('User not found');
    res.status(204).end();
  })
);
