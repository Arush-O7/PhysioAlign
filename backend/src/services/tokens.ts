import crypto from 'crypto';
import { config } from '../config.js';

export const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

const sign = (data: string) => crypto.createHmac('sha256', config.authSecret).update(data).digest('base64url');

// payload.signature, HMAC-SHA256. email is only included for google users,
// who don't have a users row until they finish onboarding
export function createToken(userId: string, email?: string | null): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      email: email || undefined,
      exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
    })
  ).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: string | undefined): { sub: string; email?: string } | null {
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!data.sub || data.exp < Date.now() / 1000) return null;
    return data;
  } catch {
    return null;
  }
}
