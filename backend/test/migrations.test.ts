import { beforeEach, describe, expect, it } from 'vitest';
import { hasDatabase } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { migrate, migrations } from '../src/db/migrations.js';
import { whenIdle } from '../src/services/critiqueQueue.js';

describe.skipIf(!hasDatabase)('migrations', () => {
  beforeEach(async () => {
    await whenIdle();
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  });

  it('upgrades a database created before versioned migrations', async () => {
    // the schema as it was in production, text json columns and clerk_id naming
    await pool.query(`
      CREATE TABLE users (clerk_id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT, age INTEGER, experience TEXT,
        goal TEXT, role TEXT DEFAULT 'patient', doctor_id TEXT, care_plan TEXT, password_hash TEXT);
      CREATE TABLE sessions (id TEXT PRIMARY KEY, clerk_id TEXT REFERENCES users(clerk_id) ON DELETE CASCADE,
        pose_id TEXT NOT NULL, pose_name TEXT NOT NULL, date BIGINT NOT NULL, duration_seconds INTEGER NOT NULL,
        hold_time_seconds INTEGER NOT NULL, average_score INTEGER NOT NULL, grade TEXT NOT NULL, ai_critique TEXT, frame_logs TEXT);
      INSERT INTO users (clerk_id, name, role, care_plan) VALUES
        ('u1', 'Old Doc', 'doctor', NULL),
        ('u2', 'Pat', 'patient', '[{"poseId":"tree-pose","targetHold":20}]'),
        ('u3', 'Broken', 'patient', 'not json');
      INSERT INTO sessions VALUES
        ('s1', 'u2', 'tree-pose', 'Tree', 1, 5, 3, 80, 'B', 'nice', '[{"score":80}]'),
        ('s2', 'u2', 'tree-pose', 'Tree', 2, 5, 3, 80, 'B', NULL, '{broken');
    `);

    await migrate();

    const users = (await pool.query('SELECT user_id, role, approved, care_plan FROM users ORDER BY user_id')).rows;
    expect(users).toEqual([
      { user_id: 'u1', role: 'doctor', approved: true, care_plan: null },
      { user_id: 'u2', role: 'patient', approved: true, care_plan: [{ poseId: 'tree-pose', targetHold: 20 }] },
      { user_id: 'u3', role: 'patient', approved: true, care_plan: null },
    ]);

    const sessions = (await pool.query('SELECT id, user_id, frame_logs, critique_status FROM sessions ORDER BY id')).rows;
    expect(sessions).toEqual([
      { id: 's1', user_id: 'u2', frame_logs: [{ score: 80 }], critique_status: 'ready' },
      { id: 's2', user_id: 'u2', frame_logs: [], critique_status: 'ready' },
    ]);

    // cascade still works after the rename
    await pool.query("DELETE FROM users WHERE user_id = 'u2'");
    expect((await pool.query('SELECT COUNT(*)::int AS n FROM sessions')).rows[0].n).toBe(0);
  });

  it('builds a fresh database and is safe to run twice', async () => {
    await migrate();
    await migrate();
    const applied = (await pool.query('SELECT id FROM schema_migrations ORDER BY id')).rows.map((r) => r.id);
    expect(applied).toEqual(migrations.map((m) => m.id));

    const indexes = (await pool.query("SELECT indexname FROM pg_indexes WHERE tablename = 'sessions'")).rows.map((r) => r.indexname);
    expect(indexes).toContain('sessions_user_date_idx');
  });
});
