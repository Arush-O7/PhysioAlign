import { findUserById } from './users.js';
import * as sessions from './sessions.js';
import { generateCritique } from './gemini.js';

const MAX_ATTEMPTS = 3;
const CONCURRENCY = 2;
const RETRY_DELAYS_MS = [2000, 8000];

// in-process job queue for session critiques. the session is already saved as
// 'pending' before it gets here, so if the server restarts mid-job the pending
// rows are picked up again by resumePending() on the next boot
const queue: string[] = [];
const queued = new Set<string>();
let running = 0;
const idleWaiters: (() => void)[] = [];

export function enqueueCritique(sessionId: string) {
  if (queued.has(sessionId)) return;
  queued.add(sessionId);
  queue.push(sessionId);
  pump();
}

function pump() {
  while (running < CONCURRENCY && queue.length > 0) {
    const id = queue.shift()!;
    running++;
    process(id)
      .catch((error) => console.error(`[critique] ${id} crashed:`, error))
      .finally(() => {
        running--;
        queued.delete(id);
        pump();
        if (running === 0 && queue.length === 0) idleWaiters.splice(0).forEach((resolve) => resolve());
      });
  }
}

async function process(id: string) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const session = await sessions.findSession(id);
    // deleted while waiting, or already done
    if (!session || session.critique_status !== 'pending') return;

    const user = await findUserById(session.user_id);
    if (!user) return;

    await sessions.markCritiqueAttempt(id);
    try {
      const critique = await generateCritique(session, user);
      await sessions.saveCritique(id, critique);
      return;
    } catch (error) {
      console.warn(`[critique] ${id} attempt ${attempt} failed:`, (error as Error).message);
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt - 1] ?? 10000));
      }
    }
  }
  await sessions.failCritique(id);
}

export async function resumePending() {
  const pending = await sessions.listPendingCritiques();
  if (pending.length) console.log(`[critique] Resuming ${pending.length} pending critique(s)`);
  pending.forEach(({ id }) => enqueueCritique(id));
}

// used by tests and graceful shutdown
export function whenIdle(): Promise<void> {
  if (running === 0 && queue.length === 0) return Promise.resolve();
  return new Promise((resolve) => idleWaiters.push(resolve));
}
