import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createToken, verifyToken } from '../src/services/tokens.js';
import { hashPassword, needsRehash, verifyPassword } from '../src/services/passwords.js';
import { rateLimit } from '../src/middleware/rateLimit.js';

describe('tokens', () => {
  it('round-trips and rejects tampering', () => {
    const token = createToken('user-1', 'a@b.c');
    expect(verifyToken(token)).toMatchObject({ sub: 'user-1', email: 'a@b.c' });

    const [payload, sig] = token.split('.');
    const otherPayload = Buffer.from(JSON.stringify({ sub: 'admin', exp: 9999999999 })).toString('base64url');
    expect(verifyToken(`${otherPayload}.${sig}`)).toBeNull();
    expect(verifyToken(`${payload}.x${sig.slice(1)}`)).toBeNull();
    expect(verifyToken('garbage')).toBeNull();
    expect(verifyToken(undefined)).toBeNull();
  });
});

describe('passwords', () => {
  it('hashes with a random salt and verifies', () => {
    const a = hashPassword('hunter22');
    const b = hashPassword('hunter22');
    expect(a).not.toBe(b);
    expect(verifyPassword('hunter22', a)).toBe(true);
    expect(verifyPassword('hunter23', a)).toBe(false);
    expect(verifyPassword('hunter22', null)).toBe(false);
    expect(needsRehash(a)).toBe(false);
    expect(needsRehash('salt:hash')).toBe(true);
  });
});

describe('rateLimit', () => {
  it('blocks after the limit per ip and sets Retry-After', async () => {
    const app = express();
    app.set('trust proxy', 1);
    app.use(rateLimit({ windowMs: 60_000, max: 3 }));
    app.get('/', (_req, res) => res.send('ok'));

    for (let i = 0; i < 3; i++) {
      expect((await request(app).get('/').set('X-Forwarded-For', '1.1.1.1')).status).toBe(200);
    }
    const blocked = await request(app).get('/').set('X-Forwarded-For', '1.1.1.1');
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect((await request(app).get('/').set('X-Forwarded-For', '2.2.2.2')).status).toBe(200);
  });
});
