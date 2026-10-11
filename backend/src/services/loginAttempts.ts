// Per-account throttling. The ip limiter alone doesn't stop someone spreading
// guesses for one account across addresses, so failures are also counted per
// email and the account pauses for a while after repeated misses.
const WINDOW_MS = 15 * 60 * 1000;
const SOFT_LIMIT = 5; // after this many failures, start pausing
const HARD_LIMIT = 10; // after this many, pause for the rest of the window

interface Record {
  failures: number;
  firstFailureAt: number;
  lockedUntil: number;
}

const records = new Map<string, Record>();

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of records) {
    if (record.lockedUntil < now && record.firstFailureAt + WINDOW_MS < now) records.delete(key);
  }
}, WINDOW_MS).unref();

const normalise = (email: string) => email.toLowerCase().trim();

/** seconds left before this account may try again, or 0 when it's free to go */
export function lockedFor(email: string): number {
  const record = records.get(normalise(email));
  if (!record) return 0;
  const remaining = record.lockedUntil - Date.now();
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

export function recordFailure(email: string) {
  const key = normalise(email);
  const now = Date.now();
  const record = records.get(key);

  if (!record || record.firstFailureAt + WINDOW_MS < now) {
    records.set(key, { failures: 1, firstFailureAt: now, lockedUntil: 0 });
    return;
  }

  record.failures++;
  if (record.failures >= HARD_LIMIT) {
    record.lockedUntil = now + WINDOW_MS;
  } else if (record.failures >= SOFT_LIMIT) {
    // 30s, 60s, 120s, ... so a human who mistyped waits seconds, a script waits minutes
    const step = record.failures - SOFT_LIMIT;
    record.lockedUntil = now + Math.min(WINDOW_MS, 30_000 * 2 ** step);
  }
}

export function clearFailures(email: string) {
  records.delete(normalise(email));
}

// test helper
export function resetAllAttempts() {
  records.clear();
}
