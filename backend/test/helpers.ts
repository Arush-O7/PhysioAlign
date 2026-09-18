import request from 'supertest';
import { createApp, readiness } from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { migrate } from '../src/db/migrations.js';
import { whenIdle } from '../src/services/critiqueQueue.js';

export const hasDatabase = !!process.env.TEST_DATABASE_URL;

export const app = createApp();

export async function resetDatabase() {
  // a critique from the previous test may still be writing
  await whenIdle();
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await migrate();
  readiness.ready = true;
}

// a logged-in client. keeps the session cookie and always sends the csrf header
export function client() {
  const agent = request.agent(app);
  const withHeader = (req: request.Test) => req.set('X-Requested-With', 'fetch');
  return {
    agent,
    get: (url: string) => withHeader(agent.get(url)),
    post: (url: string, body?: object) => withHeader(agent.post(url)).send(body ?? {}),
    put: (url: string, body?: object) => withHeader(agent.put(url)).send(body ?? {}),
    delete: (url: string) => withHeader(agent.delete(url)),
  };
}

export type Client = ReturnType<typeof client>;

let counter = 0;
export async function signup(role: 'patient' | 'doctor' | 'admin' = 'patient', name = `user${++counter}`) {
  const c = client();
  const res = await c.post('/api/auth/signup', { name, email: `${name}@example.com`, password: 'secret123', role });
  if (res.status !== 201) throw new Error(`signup failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { c, user: res.body.user as { id: string; role: string; approved: boolean } };
}

export async function completeProfile(c: Client) {
  return c.put('/api/users/me', { name: 'Pat', age: 30, experience: 'beginner', goal: 'balance' });
}

export function sessionPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: `s_${Math.random().toString(36).slice(2, 10)}`,
    poseId: 'tree-pose',
    poseName: 'Tree Pose',
    date: Date.now(),
    durationSeconds: 3,
    holdTimeSeconds: 2,
    averageScore: 78,
    grade: 'B',
    frameLogs: [
      { timestamp: 1, score: 70, angles: { leftKnee: 170 }, feedbackMessage: 'Standing Leg: Adjust slightly.' },
      { timestamp: 2, score: 80, angles: { leftKnee: 176 }, feedbackMessage: 'Perfect Alignment' },
      { timestamp: 3, score: 84, angles: { leftKnee: 178 }, feedbackMessage: 'Perfect Alignment' },
    ],
    ...overrides,
  };
}
