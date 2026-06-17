import sqlite3 from 'sqlite3';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isPostgres = !!process.env.DATABASE_URL;

let dbSQLite = null;
let pgPool = null;

if (isPostgres) {
  console.log('[PhysioAlign DB] Connecting to cloud Neon Postgres database...');
  pgPool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false // Required for Neon/serverless Postgres
    }
  });
} else {
  const dbPath = path.resolve(__dirname, 'database.sqlite');
  console.log('[PhysioAlign DB] Connecting to local SQLite database at:', dbPath);
  dbSQLite = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('[PhysioAlign DB] Local SQLite connection error:', err.message);
    } else {
      console.log('[PhysioAlign DB] Connected to the local database successfully.');
    }
  });
}

// Convert SQLite query placeholders (?) to Postgres ($1, $2, ...)
function convertSql(sql) {
  if (!isPostgres) return sql;
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
}

export const dbRun = async (sql, params = []) => {
  if (isPostgres) {
    const pgSql = convertSql(sql);
    try {
      const res = await pgPool.query(pgSql, params);
      return { changes: res.rowCount };
    } catch (err) {
      console.error('[PhysioAlign DB] Postgres execution error:', err);
      throw err;
    }
  } else {
    return new Promise((resolve, reject) => {
      dbSQLite.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }
};

export const dbGet = async (sql, params = []) => {
  if (isPostgres) {
    const pgSql = convertSql(sql);
    try {
      const res = await pgPool.query(pgSql, params);
      return res.rows[0];
    } catch (err) {
      console.error('[PhysioAlign DB] Postgres fetch error:', err);
      throw err;
    }
  } else {
    return new Promise((resolve, reject) => {
      dbSQLite.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }
};

export const dbAll = async (sql, params = []) => {
  if (isPostgres) {
    const pgSql = convertSql(sql);
    try {
      const res = await pgPool.query(pgSql, params);
      return res.rows;
    } catch (err) {
      console.error('[PhysioAlign DB] Postgres fetch-all error:', err);
      throw err;
    }
  } else {
    return new Promise((resolve, reject) => {
      dbSQLite.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
};

// Initialize table schemas using BIGINT for JS timestamps
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
        care_plan TEXT
      )
    `);
    
    // Defensive migrations
    try {
      await dbRun("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'patient'");
      console.log('[PhysioAlign DB] Database migration: Added role column to users table.');
    } catch (e) {
      // Column already exists, safe to ignore
    }

    try {
      await dbRun("ALTER TABLE users ADD COLUMN doctor_id TEXT");
      console.log('[PhysioAlign DB] Database migration: Added doctor_id column to users table.');
    } catch (e) {
      // Column already exists, safe to ignore
    }

    try {
      await dbRun("ALTER TABLE users ADD COLUMN care_plan TEXT");
      console.log('[PhysioAlign DB] Database migration: Added care_plan column to users table.');
    } catch (e) {
      // Column already exists, safe to ignore
    }
    
    console.log('[PhysioAlign DB] Users table verified/created.');

    // Create Sessions Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        clerk_id TEXT,
        pose_id TEXT NOT NULL,
        pose_name TEXT NOT NULL,
        date BIGINT NOT NULL,
        duration_seconds INTEGER NOT NULL,
        hold_time_seconds INTEGER NOT NULL,
        average_score INTEGER NOT NULL,
        grade TEXT NOT NULL,
        ai_critique TEXT,
        frame_logs TEXT,
        FOREIGN KEY (clerk_id) REFERENCES users(clerk_id) ON DELETE CASCADE
      )
    `);
    console.log('[PhysioAlign DB] Sessions table verified/created.');
  } catch (error) {
    console.error('[PhysioAlign DB] Schema initialization failed:', error);
  }
};

export default { dbRun, dbGet, dbAll, initDB };
