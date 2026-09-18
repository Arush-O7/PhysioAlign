import crypto from 'crypto';

const ITERATIONS = 210000;

// stored as pbkdf2$iterations$salt$hash. older accounts use salt:hash with 1000 iterations
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, 64, 'sha512').toString('hex');
  return `pbkdf2$${ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;

  let iterations: number;
  let salt: string;
  let originalHash: string;
  if (stored.startsWith('pbkdf2$')) {
    const [, iter, s, h] = stored.split('$');
    iterations = Number(iter);
    salt = s;
    originalHash = h;
  } else if (stored.includes(':')) {
    [salt, originalHash] = stored.split(':');
    iterations = 1000;
  } else {
    return false;
  }
  if (!salt || !originalHash || !iterations) return false;

  const hash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512');
  const expected = Buffer.from(originalHash, 'hex');
  return expected.length === hash.length && crypto.timingSafeEqual(hash, expected);
}

export const needsRehash = (stored: string) => !stored.startsWith(`pbkdf2$${ITERATIONS}$`);
