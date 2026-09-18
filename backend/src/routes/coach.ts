import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { badRequest } from '../lib/errors.js';
import { validateBody } from '../middleware/validate.js';
import { askCoach } from '../services/gemini.js';
import { coachSchema } from './schemas.js';

export const coachRouter = Router();

coachRouter.post(
  '/chat',
  validateBody(coachSchema),
  asyncHandler(async (req, res) => {
    if (!req.auth.user) throw badRequest('Finish setting up your profile first');
    const { coachId, history, message } = req.body;
    res.json({ reply: await askCoach(coachId, history, message, req.auth.user) });
  })
);
