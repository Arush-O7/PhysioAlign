// read-only connectivity check: npm run db:check
import { pool } from '../backend/src/db/pool.js';

try {
  const { rows } = await pool.query('SELECT now() AS time, version() AS version');
  console.log('Connected. Server time:', rows[0].time);
  console.log(rows[0].version.split(',')[0]);

  const applied = await pool
    .query('SELECT id, name, applied_at FROM schema_migrations ORDER BY id')
    .then((r) => r.rows)
    .catch(() => []);
  console.log(applied.length ? 'Applied migrations:' : 'No migrations applied yet (they run when the server starts)');
  applied.forEach((m) => console.log(`  ${m.id}_${m.name}  ${m.applied_at.toISOString()}`));
} catch (error) {
  console.error('Database check failed:', (error as Error).message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
