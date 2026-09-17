import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

// Parse int8 (BIGINT) as Javascript integer instead of string
pg.types.setTypeParser(20, (val) => parseInt(val, 10));

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('[PhysioAlign DB] WARNING: DATABASE_URL environment variable is not defined.');
}

// supabase's direct host (db.<ref>.supabase.co) is ipv6 only, render can't reach it
if (connectionString && /@db\.[a-z0-9]+\.supabase\.co/.test(connectionString)) {
  console.warn('[PhysioAlign DB] DATABASE_URL uses the direct Supabase host, which is IPv6 only. ' +
    'On Render use the Session pooler URL from Supabase > Connect instead.');
}

const pool = new Pool({
  connectionString,
  connectionTimeoutMillis: 10000,
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

// 42703 = undefined column, 42P01 = undefined table. happens when the schema
// setup couldn't run at boot (e.g. the database was paused), so run it now and retry once
const SCHEMA_ERRORS = new Set(['42703', '42P01']);
let schemaFix = null;

const query = async (sql, params) => {
  const pgSql = translateQuery(sql);
  try {
    return await pool.query(pgSql, params);
  } catch (error) {
    if (!SCHEMA_ERRORS.has(error.code)) throw error;
    console.warn('[PhysioAlign DB] Schema out of date, running setup again:', error.message);
    schemaFix ??= initDB().finally(() => { schemaFix = null; });
    await schemaFix;
    return pool.query(pgSql, params);
  }
};

export const dbRun = async (sql, params = []) => {
  const res = await query(sql, params);
  return { lastID: null, changes: res.rowCount };
};

export const dbGet = async (sql, params = []) => {
  const res = await query(sql, params);
  return res.rows[0];
};

export const dbAll = async (sql, params = []) => {
  const res = await query(sql, params);
  return res.rows;
};

// Initialize table schemas
export const initDB = async () => {
  try {
    // Create Users Table
    await pool.query(`
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
    // approved defaults to true so doctors that existed before approvals keep access
    for (const column of ["role TEXT DEFAULT 'patient'", 'doctor_id TEXT', 'care_plan TEXT', 'password_hash TEXT', 'approved BOOLEAN NOT NULL DEFAULT TRUE']) {
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${column}`);
    }

    console.log('[PhysioAlign DB] Users table verified/created.');

    // Create Sessions Table
    await pool.query(`
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
    return true;
  } catch (error) {
    console.error('[PhysioAlign DB] Schema initialization failed:', error.message);
    return false;
  }
};

// connection level failures, as opposed to a bad query
export const isConnectionError = (error) =>
  /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|ENETUNREACH|EHOSTUNREACH|timeout|not available|terminat/i.test(
    `${error?.code || ''} ${error?.message || ''}`
  );

export const DB_UNAVAILABLE = "Can't reach the database right now. Please try again in a minute.";

export default { dbRun, dbGet, dbAll, initDB, pool };
