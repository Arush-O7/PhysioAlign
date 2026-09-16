import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

// Parse int8 (BIGINT) as Javascript integer instead of string
pg.types.setTypeParser(20, (val) => parseInt(val, 10));

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('[PhysioAlign DB] WARNING: DATABASE_URL environment variable is not defined.');
}

console.log('[PhysioAlign DB] Connecting to Supabase PostgreSQL database.');

const pool = new Pool({
  connectionString,
  ssl: connectionString && (connectionString.includes('localhost') || connectionString.includes('127.0.0.1'))
    ? false
    : { rejectUnauthorized: false }
});

pool.on('error', (err) => {
  console.error('[PhysioAlign DB] Unexpected error on idle client:', err.message);
});

// Helper to translate SQLite '?' placeholders to PostgreSQL '$1, $2, ...' placeholders
export const translateQuery = (sql) => {
  let paramIndex = 1;
  return sql.replace(/\?/g, () => `$${paramIndex++}`);
};

export const dbRun = async (sql, params = []) => {
  const pgSql = translateQuery(sql);
  const res = await pool.query(pgSql, params);
  return { lastID: null, changes: res.rowCount };
};

export const dbGet = async (sql, params = []) => {
  const pgSql = translateQuery(sql);
  const res = await pool.query(pgSql, params);
  return res.rows[0];
};

export const dbAll = async (sql, params = []) => {
  const pgSql = translateQuery(sql);
  const res = await pool.query(pgSql, params);
  return res.rows;
};

// Initialize table schemas
export const initDB = async () => {
  try {
    // Create Users Table
    await dbRun(`
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
        password_hash TEXT
      )
    `);
    
    // older databases were created before these columns existed
    for (const column of ["role TEXT DEFAULT 'patient'", 'doctor_id TEXT', 'care_plan TEXT', 'password_hash TEXT']) {
      await dbRun(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${column}`);
    }

    console.log('[PhysioAlign DB] Users table verified/created.');

    // Create Sessions Table
    await dbRun(`
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
      )
    `);
    console.log('[PhysioAlign DB] Sessions table verified/created.');
  } catch (error) {
    console.error('[PhysioAlign DB] Schema initialization failed:', error.message);
  }
};

export default { dbRun, dbGet, dbAll, initDB, pool };
