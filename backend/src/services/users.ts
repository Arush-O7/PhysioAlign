import crypto from 'crypto';
import { config } from '../config.js';
import { many, one, run } from '../db/pool.js';
import type { AuthContext, CarePlanItem, Role, UserRow } from '../lib/types.js';

export const findUserById = (id: string) => one<UserRow>('SELECT * FROM users WHERE user_id = $1', [id]);

export const findUserByEmail = (email: string) =>
  one<UserRow>('SELECT * FROM users WHERE LOWER(email) = $1 LIMIT 1', [email.toLowerCase().trim()]);

export async function createEmailUser(input: { name: string; email: string; passwordHash: string; role: Role }) {
  const id = `usr_${crypto.randomBytes(8).toString('hex')}`;
  const row = await one<UserRow>(
    `INSERT INTO users (user_id, name, email, password_hash, role, approved)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    // doctors start unapproved until an admin signs them off
    [id, input.name, input.email.toLowerCase().trim(), input.passwordHash, input.role, input.role !== 'doctor']
  );
  return row!;
}

export async function createProfile(
  auth: AuthContext,
  input: { name: string; age: number; experience: string; goal: string; role: Role }
) {
  const row = await one<UserRow>(
    `INSERT INTO users (user_id, name, email, age, experience, goal, role, approved)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [auth.id, input.name, auth.email, input.age, input.experience, input.goal, input.role, input.role !== 'doctor']
  );
  return row!;
}

// role is never changed here, only admins can do that
export async function updateProfile(id: string, input: { name: string; age: number; experience: string; goal: string }) {
  const row = await one<UserRow>(
    'UPDATE users SET name = $2, age = $3, experience = $4, goal = $5 WHERE user_id = $1 RETURNING *',
    [id, input.name, input.age, input.experience, input.goal]
  );
  return row!;
}

export const updatePasswordHash = (id: string, hash: string) =>
  run('UPDATE users SET password_hash = $2 WHERE user_id = $1', [id, hash]);

// admin can only be picked at signup by allow-listed emails, or by the very first
// account when ADMIN_EMAILS isn't set, so a fresh install can still be set up
export async function canSelfAssignAdmin(email: string | null): Promise<boolean> {
  if (config.adminEmails.length > 0) {
    return !!email && config.adminEmails.includes(email.toLowerCase());
  }
  return !(await one("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1"));
}

// admins can see everyone, doctors only the patients assigned to them
export async function canViewUser(auth: AuthContext, userId: string): Promise<boolean> {
  if (userId === auth.id || auth.role === 'admin') return true;
  if (auth.role !== 'doctor') return false;
  const patient = await one<{ doctor_id: string | null }>('SELECT doctor_id FROM users WHERE user_id = $1', [userId]);
  return patient?.doctor_id === auth.id;
}

export function listPatients(doctorId?: string) {
  return many<UserRow & { session_count: number; avg_score: number | null }>(
    `SELECT u.*, COUNT(s.id)::int AS session_count, ROUND(AVG(s.average_score))::int AS avg_score
     FROM users u
     LEFT JOIN sessions s ON s.user_id = u.user_id
     WHERE u.role = 'patient' AND ($1::text IS NULL OR u.doctor_id = $1)
     GROUP BY u.user_id
     ORDER BY u.name`,
    [doctorId ?? null]
  );
}

export const setCarePlan = (patientId: string, plan: CarePlanItem[]) =>
  run('UPDATE users SET care_plan = $2 WHERE user_id = $1', [patientId, JSON.stringify(plan)]);

export const listAllUsers = () => many<UserRow>('SELECT * FROM users ORDER BY role DESC, name');

// an admin picking the role counts as approving it
export const setRole = (id: string, role: Role) =>
  run('UPDATE users SET role = $2, approved = TRUE WHERE user_id = $1', [id, role]);

export const approveDoctor = (id: string) =>
  run("UPDATE users SET approved = TRUE WHERE user_id = $1 AND role = 'doctor'", [id]);

export const isApprovedDoctor = async (id: string) =>
  !!(await one("SELECT 1 FROM users WHERE user_id = $1 AND role = 'doctor' AND approved", [id]));

export const assignDoctor = (patientId: string, doctorId: string | null) =>
  run('UPDATE users SET doctor_id = $2 WHERE user_id = $1', [patientId, doctorId]);

export const deleteUser = (id: string) => run('DELETE FROM users WHERE user_id = $1', [id]);

export async function stats() {
  const row = await one<{ users: number; patients: number; doctors: number; sessions: number; db_size: string }>(`
    SELECT
      (SELECT COUNT(*) FROM users)::int AS users,
      (SELECT COUNT(*) FROM users WHERE role = 'patient')::int AS patients,
      (SELECT COUNT(*) FROM users WHERE role = 'doctor')::int AS doctors,
      (SELECT COUNT(*) FROM sessions)::int AS sessions,
      pg_size_pretty(pg_database_size(current_database())) AS db_size
  `);
  return row!;
}
