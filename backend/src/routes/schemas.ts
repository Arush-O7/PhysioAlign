import { z } from 'zod';

export const role = z.enum(['patient', 'doctor', 'admin']);

export const signupSchema = z.object({
  name: z.string().trim().min(1).max(60),
  email: z.string().trim().email().max(200),
  password: z.string().min(6, 'Password must be at least 6 characters').max(200),
  role: role.default('patient'),
});

export const loginSchema = z.object({
  email: z.string().trim().min(1).max(200),
  password: z.string().min(1).max(200),
});

export const googleSchema = z.object({ credential: z.string().min(10).max(5000) });

export const profileSchema = z.object({
  name: z.string().trim().min(1).max(40),
  age: z.number().int().min(5).max(110),
  experience: z.enum(['beginner', 'intermediate', 'advanced']),
  goal: z.enum(['flexibility', 'strength', 'balance', 'rehabilitation']),
  role: role.default('patient'),
});

const frameLog = z.object({
  timestamp: z.number(),
  score: z.number().min(0).max(100),
  angles: z.record(z.number()),
  feedbackMessage: z.string().max(300),
});

export const sessionSchema = z
  .object({
    id: z.string().min(1).max(64),
    poseId: z.string().min(1).max(64),
    poseName: z.string().min(1).max(120),
    date: z.number().int().positive(),
    durationSeconds: z.number().int().min(0).max(4 * 60 * 60),
    holdTimeSeconds: z.number().int().min(0),
    averageScore: z.number().min(0).max(100),
    grade: z.enum(['A', 'B', 'C', 'F']),
    // one log per second, so this covers a four hour session
    frameLogs: z.array(frameLog).max(4 * 60 * 60),
  })
  .refine((s) => s.holdTimeSeconds <= s.durationSeconds, 'holdTimeSeconds cannot exceed durationSeconds');

export const coachSchema = z.object({
  coachId: z.enum(['anya', 'rocky', 'maya']),
  history: z
    .array(z.object({ sender: z.enum(['user', 'coach']), text: z.string().max(4000) }))
    .max(200)
    .default([])
    // only the recent turns are sent to gemini
    .transform((h) => h.slice(-20)),
  message: z.string().trim().min(1).max(2000),
});

export const carePlanSchema = z.object({
  carePlan: z
    .array(
      z.object({
        poseId: z.string().min(1).max(64),
        poseName: z.string().max(120).optional(),
        targetHold: z.number().int().min(5).max(600),
        frequency: z.string().max(40).optional(),
      })
    )
    .max(30),
});

export const roleSchema = z.object({ role });
export const assignDoctorSchema = z.object({ doctorId: z.string().min(1).nullable() });
