import type { PoolClient } from 'pg';
import { pool } from './pool.js';

interface Migration {
  id: number;
  name: string;
  sql: string;
}

// append only. each migration runs once, inside a transaction, and is recorded in schema_migrations
export const migrations: Migration[] = [
  {
    id: 1,
    name: 'baseline',
    // matches the schema the app had before versioned migrations, so existing
    // databases and fresh ones end up in the same place
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        clerk_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        age INTEGER,
        experience TEXT,
        goal TEXT,
        role TEXT DEFAULT 'patient',
        doctor_id TEXT,
        care_plan TEXT,
        password_hash TEXT,
        approved BOOLEAN NOT NULL DEFAULT TRUE
      );
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'patient';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS doctor_id TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS care_plan TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT TRUE;

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        clerk_id TEXT REFERENCES users(clerk_id) ON DELETE CASCADE,
        pose_id TEXT NOT NULL,
        pose_name TEXT NOT NULL,
        date BIGINT NOT NULL,
        duration_seconds INTEGER NOT NULL,
        hold_time_seconds INTEGER NOT NULL,
        average_score INTEGER NOT NULL,
        grade TEXT NOT NULL,
        ai_critique TEXT,
        frame_logs TEXT
      );
    `,
  },
  {
    id: 2,
    name: 'user_id_jsonb_indexes_async_critique',
    sql: `
      -- clerk_id is left over from when auth used Clerk
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = current_schema() AND table_name = 'users' AND column_name = 'clerk_id') THEN
          ALTER TABLE users RENAME COLUMN clerk_id TO user_id;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = current_schema() AND table_name = 'sessions' AND column_name = 'clerk_id') THEN
          ALTER TABLE sessions RENAME COLUMN clerk_id TO user_id;
        END IF;
      END $$;

      -- json stored as text becomes jsonb. anything that doesn't parse falls back instead of failing the migration
      CREATE OR REPLACE FUNCTION pg_temp.safe_jsonb(value TEXT, fallback JSONB) RETURNS JSONB AS $$
      BEGIN
        RETURN value::jsonb;
      EXCEPTION WHEN others THEN
        RETURN fallback;
      END;
      $$ LANGUAGE plpgsql;

      ALTER TABLE sessions ALTER COLUMN frame_logs TYPE JSONB USING pg_temp.safe_jsonb(frame_logs, '[]'::jsonb);
      UPDATE sessions SET frame_logs = '[]'::jsonb WHERE frame_logs IS NULL;
      ALTER TABLE sessions ALTER COLUMN frame_logs SET DEFAULT '[]'::jsonb;
      ALTER TABLE sessions ALTER COLUMN frame_logs SET NOT NULL;

      ALTER TABLE users ALTER COLUMN care_plan TYPE JSONB USING pg_temp.safe_jsonb(care_plan, NULL);
      DROP FUNCTION pg_temp.safe_jsonb(TEXT, JSONB);

      ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
      UPDATE users SET role = 'patient' WHERE role IS NULL;
      ALTER TABLE users ALTER COLUMN role SET NOT NULL;
      ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('patient', 'doctor', 'admin'));

      -- critiques are generated in the background now, so track where each one is
      ALTER TABLE sessions ADD COLUMN critique_status TEXT NOT NULL DEFAULT 'ready'
        CHECK (critique_status IN ('pending', 'ready', 'failed'));
      ALTER TABLE sessions ADD COLUMN critique_attempts INTEGER NOT NULL DEFAULT 0;

      CREATE INDEX IF NOT EXISTS sessions_user_date_idx ON sessions (user_id, date DESC);
      CREATE INDEX IF NOT EXISTS sessions_pending_critique_idx ON sessions (critique_status) WHERE critique_status = 'pending';
      CREATE INDEX IF NOT EXISTS users_doctor_idx ON users (doctor_id) WHERE doctor_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS users_email_lower_idx ON users (LOWER(email));
    `,
  },
];

// arbitrary constant, stops two server instances migrating at the same time
const MIGRATION_LOCK_ID = 7426211;

export async function migrate(): Promise<void> {
  const client: PoolClient = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    const { rows } = await client.query<{ id: number }>('SELECT id FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.id));

    for (const migration of migrations) {
      if (applied.has(migration.id)) continue;
      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query('INSERT INTO schema_migrations (id, name) VALUES ($1, $2)', [migration.id, migration.name]);
        await client.query('COMMIT');
        console.log(`[db] Applied migration ${migration.id}_${migration.name}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${migration.id}_${migration.name} failed: ${(error as Error).message}`);
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]).catch(() => {});
    client.release();
  }
}
