import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set, add it to .env first');
  process.exit(1);
}
console.log('Connecting to:', connectionString.replace(/:[^@]+@/, ':***@'));

const pool = new Pool({
  connectionString,
  ssl: connectionString && (connectionString.includes('localhost') || connectionString.includes('127.0.0.1'))
    ? false
    : { rejectUnauthorized: false }
});

try {
  const res = await pool.query('SELECT NOW() as time');
  console.log('Connection OK. Server time:', res.rows[0].time);

  const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
  console.log('Tables:', tables.rows.map(r => r.table_name));

  const testId = 'dbcheck_' + Date.now();
  await pool.query(
    'INSERT INTO users (clerk_id, name, email, role) VALUES ($1, $2, $3, $4)',
    [testId, 'DB Check', 'dbcheck@example.com', 'patient']
  );
  console.log('INSERT user OK:', testId);

  const user = await pool.query('SELECT * FROM users WHERE clerk_id = $1', [testId]);
  console.log('SELECT user OK:', user.rows[0]);

  await pool.query('DELETE FROM users WHERE clerk_id = $1', [testId]);
  console.log('DELETE cleanup OK');

  console.log('\ndatabase looks fine');
} catch (err) {
  console.error('\ndatabase check failed:', err.message);
  console.error(err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
