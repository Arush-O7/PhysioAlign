import crypto from 'crypto';
import { dbGet } from './db.js';

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;
const PBKDF2_ITERATIONS = 210000;

export const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ||
  process.env.VITE_GOOGLE_CLIENT_ID ||
  '303655418647-jmkugqbao9oc38na1qigl309qsa7gg96.apps.googleusercontent.com';

let secret = process.env.AUTH_SECRET;
if (!secret) {
  // fine for local dev, but everyone gets logged out when the server restarts
  console.warn('[PhysioAlign Auth] AUTH_SECRET is not set, using a random one for this run.');
  secret = crypto.randomBytes(32).toString('hex');
}

const base64url = (input) => Buffer.from(input).toString('base64url');
const sign = (data) => crypto.createHmac('sha256', secret).update(data).digest('base64url');

// email is only included for google users, who don't have a db row until onboarding
export function createToken(userId, email) {
  const payload = base64url(JSON.stringify({
    sub: userId,
    email: email || undefined,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  }));
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
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

// stored as pbkdf2$iterations$salt$hash. older accounts use salt:hash with 1000 iterations
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 64, 'sha512').toString('hex');
  return `pbkdf2$${PBKDF2_ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored) return false;

  let iterations, salt, originalHash;
  if (stored.startsWith('pbkdf2$')) {
    [, iterations, salt, originalHash] = stored.split('$');
    iterations = Number(iterations);
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

export const needsRehash = (stored) => !stored.startsWith(`pbkdf2$${PBKDF2_ITERATIONS}$`);

// checks the id token with google instead of trusting whatever the browser decoded
export async function verifyGoogleCredential(credential) {
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  if (!res.ok) return null;

  const info = await res.json();
  const validIssuer = info.iss === 'accounts.google.com' || info.iss === 'https://accounts.google.com';
  if (info.aud !== GOOGLE_CLIENT_ID || !validIssuer || Number(info.exp) < Date.now() / 1000) {
    return null;
  }
  if (info.email && info.email_verified !== 'true') return null;

  return {
    // existing google accounts are stored under the raw sub, keep it that way
    id: info.sub,
    name: info.name || info.email,
    email: info.email,
    picture: info.picture,
  };
}

const adminEmails = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

// admin can only be picked at signup by allow-listed emails, or by the very first
// account if ADMIN_EMAILS isn't set, so a fresh install can still be set up
export async function canSelfAssignAdmin(email) {
  if (adminEmails.length > 0) {
    return !!email && adminEmails.includes(email.toLowerCase());
  }
  const existing = await dbGet("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1");
  return !existing;
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const data = verifyToken(token);
  if (!data) {
    return res.status(401).json({ error: 'Not signed in' });
  }

  try {
    // role is read fresh each time so admin changes apply straight away
    const user = await dbGet('SELECT clerk_id, name, email, role FROM users WHERE clerk_id = ?', [data.sub]);
    req.auth = {
      id: data.sub,
      email: user?.email || data.email || null,
      user: user || null,
      role: user?.role || null,
    };
    next();
  } catch (error) {
    console.error('Auth lookup failed:', error);
    res.status(500).json({ error: 'Failed to check session' });
  }
}

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.auth || !roles.includes(req.auth.role)) {
    return res.status(403).json({ error: 'Not allowed' });
  }
  next();
};

export const isStaff = (auth) => auth.role === 'doctor' || auth.role === 'admin';
