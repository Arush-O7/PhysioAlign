import { many, one, run } from '../db/pool.js';
import type { FrameLog, SessionRow } from '../lib/types.js';

export interface NewSession {
  id: string;
  poseId: string;
  poseName: string;
  date: number;
  durationSeconds: number;
  holdTimeSeconds: number;
  averageScore: number;
  grade: string;
  frameLogs: FrameLog[];
}

// saved straight away with a pending critique, the report is filled in by the critique queue
export async function createSession(userId: string, s: NewSession) {
  const row = await one<SessionRow>(
    `INSERT INTO sessions (id, user_id, pose_id, pose_name, date, duration_seconds, hold_time_seconds,
                           average_score, grade, frame_logs, critique_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
     RETURNING *`,
    [
      s.id, userId, s.poseId, s.poseName, s.date, s.durationSeconds, s.holdTimeSeconds,
      s.averageScore, s.grade, JSON.stringify(s.frameLogs),
    ]
  );
  return row!;
}

export const findSession = (id: string) => one<SessionRow>('SELECT * FROM sessions WHERE id = $1', [id]);

export const listSessionsForUser = (userId: string, limit = 200) =>
  many<SessionRow>('SELECT * FROM sessions WHERE user_id = $1 ORDER BY date DESC LIMIT $2', [userId, limit]);

export const deleteSession = (id: string, ownerId?: string) =>
  ownerId
    ? run('DELETE FROM sessions WHERE id = $1 AND user_id = $2', [id, ownerId])
    : run('DELETE FROM sessions WHERE id = $1', [id]);

export const markCritiqueAttempt = (id: string) =>
  run('UPDATE sessions SET critique_attempts = critique_attempts + 1 WHERE id = $1', [id]);

export const saveCritique = (id: string, critique: string) =>
  run("UPDATE sessions SET ai_critique = $2, critique_status = 'ready' WHERE id = $1", [id, critique]);

export const failCritique = (id: string) =>
  run("UPDATE sessions SET critique_status = 'failed' WHERE id = $1", [id]);

export const listPendingCritiques = () =>
  many<{ id: string }>("SELECT id FROM sessions WHERE critique_status = 'pending' ORDER BY date");

export const resetCritique = (id: string) =>
  run("UPDATE sessions SET critique_status = 'pending', critique_attempts = 0 WHERE id = $1", [id]);
