import request from 'supertest';
import crypto from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app, client, hasDatabase, resetDatabase, signup } from './helpers.js';
import { pool } from '../src/db/pool.js';

describe.skipIf(!hasDatabase)('auth', () => {
  beforeEach(resetDatabase);

  it('signs up and sets an httpOnly session cookie', async () => {
    const c = client();
    const res = await c.post('/api/auth/signup', { name: 'Ada', email: 'ada@example.com', password: 'secret123' });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: 'Ada', email: 'ada@example.com', role: 'patient' });
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(res.body)).not.toContain('pbkdf2');

    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toMatch(/^pa_session=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
  });

  it('rejects invalid signup input', async () => {
    const c = client();
    expect((await c.post('/api/auth/signup', { name: 'A', email: 'not-an-email', password: 'secret123' })).status).toBe(400);
    const short = await c.post('/api/auth/signup', { name: 'A', email: 'a@example.com', password: '123' });
    expect(short.status).toBe(400);
    expect(short.body.error).toMatch(/at least 6/);
    expect((await c.post('/api/auth/signup', { name: 'A', email: 'a@example.com', password: 'secret123', role: 'root' })).status).toBe(400);
  });

  it('rejects duplicate emails regardless of case', async () => {
    await signup('patient', 'dup');
    const res = await client().post('/api/auth/signup', { name: 'x', email: 'DUP@example.com', password: 'secret123' });
    expect(res.status).toBe(400);
  });

  it('logs in with the right password only', async () => {
    await signup('patient', 'lin');
    const ok = await client().post('/api/auth/login', { email: 'LIN@example.com', password: 'secret123' });
    expect(ok.status).toBe(200);
    expect(ok.headers['set-cookie'][0]).toMatch(/pa_session=/);
    expect((await client().post('/api/auth/login', { email: 'lin@example.com', password: 'wrong-pass' })).status).toBe(401);
    expect((await client().post('/api/auth/login', { email: 'nobody@example.com', password: 'whatever' })).status).toBe(401);
  });

  it('upgrades legacy 1000-iteration password hashes on login', async () => {
    const salt = 'abcd';
    const legacy = `${salt}:${crypto.pbkdf2Sync('oldpass1', salt, 1000, 64, 'sha512').toString('hex')}`;
    await pool.query("INSERT INTO users (user_id, name, email, password_hash, role) VALUES ('legacy', 'Old', 'old@example.com', $1, 'patient')", [legacy]);

    expect((await client().post('/api/auth/login', { email: 'old@example.com', password: 'oldpass1' })).status).toBe(200);
    const { rows } = await pool.query("SELECT password_hash FROM users WHERE user_id = 'legacy'");
    expect(rows[0].password_hash).toMatch(/^pbkdf2\$210000\$/);
    expect((await client().post('/api/auth/login', { email: 'old@example.com', password: 'oldpass1' })).status).toBe(200);
  });

  it('requires a valid cookie for protected routes', async () => {
    expect((await client().get('/api/users/me')).status).toBe(401);

    const forged = await request(app).get('/api/users/me').set('Cookie', 'pa_session=eyJzdWIiOiJ4In0.bad-signature');
    expect(forged.status).toBe(401);
  });

  it('blocks state-changing requests without the csrf header', async () => {
    const { c } = await signup();
    const res = await c.agent.put('/api/users/me').send({ name: 'x', age: 30, experience: 'beginner', goal: 'balance' });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/X-Requested-With/);
  });

  it('only lets the first account self-assign admin when ADMIN_EMAILS is empty', async () => {
    await signup('admin', 'first');
    const second = await client().post('/api/auth/signup', { name: 'b', email: 'b@example.com', password: 'secret123', role: 'admin' });
    expect(second.status).toBe(403);
  });

  it('clears the cookie on logout', async () => {
    const { c } = await signup();
    const res = await c.post('/api/auth/logout');
    expect(res.status).toBe(204);
    expect(res.headers['set-cookie'][0]).toMatch(/pa_session=;/);
    expect((await c.get('/api/users/me')).status).toBe(401);
  });

  it('only trusts google tokens that google verifies for this client id', async () => {
    const tokeninfo = vi.spyOn(globalThis, 'fetch');

    tokeninfo.mockResolvedValueOnce(new Response('{"error":"invalid_token"}', { status: 400 }));
    expect((await client().post('/api/auth/google', { credential: 'forged-credential-123' })).status).toBe(401);

    // valid token, but issued for somebody else's app
    tokeninfo.mockResolvedValueOnce(
      Response.json({ aud: 'other-app', iss: 'accounts.google.com', exp: `${Date.now() / 1000 + 60}`, sub: '1' })
    );
    expect((await client().post('/api/auth/google', { credential: 'wrong-audience-123' })).status).toBe(401);

    const { config } = await import('../src/config.js');
    tokeninfo.mockResolvedValueOnce(
      Response.json({
        aud: config.googleClientId, iss: 'https://accounts.google.com', exp: `${Date.now() / 1000 + 60}`,
        sub: 'g-123', email: 'g@example.com', email_verified: 'true', name: 'Gee',
      })
    );
    const c = client();
    const ok = await c.post('/api/auth/google', { credential: 'good-credential-123' });
    expect(ok.status).toBe(200);
    expect(ok.body.user).toMatchObject({ id: 'g-123', email: 'g@example.com' });
    // signed in but no profile yet, so onboarding comes next
    expect((await c.get('/api/users/me')).status).toBe(404);
    const created = await c.put('/api/users/me', { name: 'Gee', age: 28, experience: 'beginner', goal: 'balance' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ id: 'g-123', email: 'g@example.com', role: 'patient' });

    tokeninfo.mockRestore();
  });
});
