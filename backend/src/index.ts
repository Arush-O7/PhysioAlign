import { createApp, readiness } from './app.js';
import { config } from './config.js';
import { pool } from './db/pool.js';
import { migrate } from './db/migrations.js';
import { resumePending, whenIdle } from './services/critiqueQueue.js';

const RETRY_MS = 15000;

// keep trying until the database is reachable (e.g. a paused supabase project waking up)
async function prepareDatabase() {
  try {
    await migrate();
    readiness.ready = true;
    console.log('[server] Database ready');
    await resumePending();
  } catch (error) {
    console.error(`[server] Database setup failed, retrying in ${RETRY_MS / 1000}s:`, (error as Error).message);
    setTimeout(prepareDatabase, RETRY_MS).unref();
  }
}

const server = createApp().listen(config.port, () => {
  console.log(`[server] Listening on port ${config.port}`);
  prepareDatabase();
});

// render sends SIGTERM on deploys. stop taking requests and let queued critiques finish
async function shutdown(signal: string) {
  console.log(`[server] ${signal} received, shutting down`);
  server.close();
  await Promise.race([whenIdle(), new Promise((r) => setTimeout(r, 10000))]);
  await pool.end();
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
