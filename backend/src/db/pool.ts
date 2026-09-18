import pg from 'pg';
import { config } from '../config.js';

// return BIGINT (the session date) as a number instead of a string
pg.types.setTypeParser(20, (val) => parseInt(val, 10));

const connectionString = config.databaseUrl;

// supabase's direct host (db.<ref>.supabase.co) is ipv6 only, which render can't reach
if (connectionString && /@db\.[a-z0-9]+\.supabase\.co/.test(connectionString)) {
  console.warn(
    '[db] DATABASE_URL uses the direct Supabase host, which is IPv6 only. ' +
      'On Render use the Session pooler URL from Supabase > Connect instead.'
  );
}

// managed hosts (supabase, render) need ssl. local and docker databases don't,
// docker-compose opts out with sslmode=disable in the url
const noSsl = !connectionString || /localhost|127\.0\.0\.1|sslmode=disable/.test(connectionString);

export const pool = new pg.Pool({
  connectionString,
  ssl: noSsl ? false : { rejectUnauthorized: false },
  max: 10,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('[db] Unexpected error on idle client:', err.message);
});

export async function many<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool.query(sql, params);
  return res.rows as T[];
}

export async function one<T = any>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  const res = await pool.query(sql, params);
  return res.rows[0] as T | undefined;
}

export async function run(sql: string, params: unknown[] = []): Promise<number> {
  const res = await pool.query(sql, params);
  return res.rowCount ?? 0;
}

// connection level failures, as opposed to a bad query
export const isConnectionError = (error: any) =>
  /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|ENETUNREACH|EHOSTUNREACH|timeout|not available|terminat/i.test(
    `${error?.code || ''} ${error?.message || ''}`
  );
