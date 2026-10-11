import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { client, completeProfile, hasDatabase, resetDatabase, sessionPayload, signup } from './helpers.js';
import { app } from './helpers.js';
import { rateLimit, byUser } from '../src/middleware/rateLimit.js';
import { securityHeaders } from '../src/middleware/security.js';
import { clearFailures, lockedFor, recordFailure, resetAllAttempts } from '../src/services/loginAttempts.js';

describe('rate limiter', () => {
  const build = (options: Parameters<typeof rateLimit>[0]) => {
    const test = express();
    test.set('trust proxy', 1);
    test.use(express.json());
    test.use(rateLimit(options));
    test.get('/', (_req, res) => res.json({ ok: true }));
    test.post('/login', (req, res) => res.status(req.body.good ? 200 : 401).json({ ok: !!req.body.good }));
    return test;
  };

  it('allows up to the limit then answers 429 with headers', async () => {
    const test = build({ windowMs: 60_000, max: 3 });
    for (let i = 0; i < 3; i++) {
      const res = await request(test).get('/').set('X-Forwarded-For', '5.5.5.5');
      expect(res.status).toBe(200);
      expect(res.headers['ratelimit-limit']).toBe('3');
    }
    const blocked = await request(test).get('/').set('X-Forwarded-For', '5.5.5.5');
    expect(blocked.status).toBe(429);
    expect(blocked.headers['ratelimit-remaining']).toBe('0');
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect(blocked.body.retryAfterSeconds).toBeGreaterThan(0);
    // a different client is unaffected
    expect((await request(test).get('/').set('X-Forwarded-For', '6.6.6.6')).status).toBe(200);
  });

  it('refunds successful attempts so normal sign-ins never trip it', async () => {
    const test = build({ windowMs: 60_000, max: 3, skipSuccessful: true });
    for (let i = 0; i < 6; i++) {
      const res = await request(test).post('/login').set('X-Forwarded-For', '7.7.7.7').send({ good: true });
      expect(res.status).toBe(200);
    }
    // failures still count
    for (let i = 0; i < 3; i++) await request(test).post('/login').set('X-Forwarded-For', '7.7.7.7').send({ good: false });
    expect((await request(test).post('/login').set('X-Forwarded-For', '7.7.7.7').send({ good: false })).status).toBe(429);
  });

  it('can count per user instead of per ip', async () => {
    const test = express();
    test.use((req, _res, next) => {
      req.auth = { id: req.get('X-User') || 'anon', email: null, user: null, role: 'patient' };
      next();
    });
    test.use(rateLimit({ windowMs: 60_000, max: 2, key: byUser }));
    test.get('/', (_req, res) => res.json({ ok: true }));

    for (let i = 0; i < 2; i++) expect((await request(test).get('/').set('X-User', 'u1')).status).toBe(200);
    expect((await request(test).get('/').set('X-User', 'u1')).status).toBe(429);
    // same ip, different account: still allowed
    expect((await request(test).get('/').set('X-User', 'u2')).status).toBe(200);
  });
});

describe('login attempt lockout', () => {
  beforeEach(resetAllAttempts);

  it('stays open for a few mistakes, then pauses the account', () => {
    for (let i = 0; i < 4; i++) recordFailure('victim@example.com');
    expect(lockedFor('victim@example.com')).toBe(0);

    recordFailure('victim@example.com');
    expect(lockedFor('victim@example.com')).toBeGreaterThan(0);
  });

  it('is per account and clears on a good password', () => {
    for (let i = 0; i < 6; i++) recordFailure('a@example.com');
    expect(lockedFor('a@example.com')).toBeGreaterThan(0);
    expect(lockedFor('b@example.com')).toBe(0);

    clearFailures('a@example.com');
    expect(lockedFor('a@example.com')).toBe(0);
  });

  it('treats the email case-insensitively', () => {
    for (let i = 0; i < 6; i++) recordFailure('Mixed@Example.com');
    expect(lockedFor('mixed@example.com')).toBeGreaterThan(0);
  });
});

describe('security headers', () => {
  it('sets a csp that still allows the pose model, fonts and google sign-in', async () => {
    const test = express();
    test.use(securityHeaders);
    test.get('/', (_req, res) => res.send('ok'));
    const res = await request(test).get('/');

    const csp = res.headers['content-security-policy'];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain('https://cdn.jsdelivr.net'); // wasm
    expect(csp).toContain('https://storage.googleapis.com'); // model weights
    expect(csp).toContain('https://accounts.google.com'); // sign-in
    expect(csp).toContain('https://fonts.gstatic.com');
    // the google sign-in button pulls its own stylesheet
    expect(csp).toMatch(/style-src[^;]*https:\/\/accounts\.google\.com/);
    expect(csp).not.toContain("'unsafe-eval'");

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(res.headers['permissions-policy']).toContain('camera=(self)');
  });
});

describe.skipIf(!hasDatabase)('account data', () => {
  beforeEach(resetDatabase);

  it('tags every response with a request id', async () => {
    const res = await client().get('/api/health');
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('paginates session history and reports the total', async () => {
    const { c, user } = await signup();
    await completeProfile(c);
    for (let i = 0; i < 5; i++) {
      await c.post('/api/sessions', sessionPayload({ id: `page-${i}`, date: 1_000 + i }));
    }

    const firstPage = await c.get(`/api/users/${user.id}/sessions?limit=2`);
    expect(firstPage.body).toHaveLength(2);
    expect(firstPage.headers['x-total-count']).toBe('5');
    expect(firstPage.body[0].id).toBe('page-4'); // newest first

    const secondPage = await c.get(`/api/users/${user.id}/sessions?limit=2&offset=2`);
    expect(secondPage.body.map((s: any) => s.id)).toEqual(['page-2', 'page-1']);

    // the cap holds even if a client asks for more
    const capped = await c.get(`/api/users/${user.id}/sessions?limit=5000`);
    expect(capped.body.length).toBeLessThanOrEqual(100);
  });

  it('exports everything it holds about the account', async () => {
    const { c } = await signup();
    await completeProfile(c);
    await c.post('/api/sessions', sessionPayload({ id: 'exported' }));

    const res = await c.get('/api/users/me/export');
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('physioalign-data-');
    expect(res.body.profile).toMatchObject({ name: 'Pat' });
    expect(res.body.sessions.map((s: any) => s.id)).toContain('exported');
    expect(JSON.stringify(res.body)).not.toContain('password');
  });

  it('lets a user delete their own account and everything in it', async () => {
    const { c, user } = await signup();
    await completeProfile(c);
    await c.post('/api/sessions', sessionPayload({ id: 'gone' }));

    const res = await c.delete('/api/users/me');
    expect(res.status).toBe(204);
    expect(res.headers['set-cookie'][0]).toMatch(/pa_session=;/);

    // the session cookie is dead and the data is gone with it
    expect((await c.get('/api/users/me')).status).toBe(401);
    const admin = await signup('admin', 'cleanup-admin');
    expect((await admin.c.get(`/api/users/${user.id}`)).status).toBe(404);
  });
});
