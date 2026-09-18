import { beforeEach, describe, expect, it } from 'vitest';
import { completeProfile, hasDatabase, resetDatabase, sessionPayload, signup } from './helpers.js';
import { whenIdle } from '../src/services/critiqueQueue.js';
import { pool } from '../src/db/pool.js';

describe.skipIf(!hasDatabase)('sessions', () => {
  beforeEach(resetDatabase);

  it('saves immediately and fills in the critique in the background', async () => {
    const { c, user } = await signup();
    await completeProfile(c);

    const res = await c.post('/api/sessions', sessionPayload({ id: 'bg-1' }));
    expect(res.status).toBe(202);
    expect(res.body).toMatchObject({ id: 'bg-1', userId: user.id, critiqueStatus: 'pending', aiCritique: null });

    await whenIdle();
    const done = await c.get('/api/sessions/bg-1');
    expect(done.body.critiqueStatus).toBe('ready');
    expect(done.body.aiCritique).toContain('Tree Pose');
    expect(done.body.frameLogs).toHaveLength(3);
  });

  it('stores frame logs as jsonb', async () => {
    const { c } = await signup();
    await completeProfile(c);
    await c.post('/api/sessions', sessionPayload({ id: 'json-1' }));
    const { rows } = await pool.query("SELECT jsonb_array_length(frame_logs) AS n FROM sessions WHERE id = 'json-1'");
    expect(rows[0].n).toBe(3);
  });

  it('ignores the user id in the body and uses the signed in user', async () => {
    const { c, user } = await signup();
    await completeProfile(c);
    const res = await c.post('/api/sessions', { ...sessionPayload(), userId: 'someone-else', clerkId: 'someone-else' });
    expect(res.body.userId).toBe(user.id);
  });

  it('validates the session payload', async () => {
    const { c } = await signup();
    await completeProfile(c);
    const bad = await c.post('/api/sessions', sessionPayload({ holdTimeSeconds: 10, durationSeconds: 5 }));
    expect(bad.status).toBe(400);
    expect(bad.body.error).toMatch(/holdTimeSeconds/);
    expect((await c.post('/api/sessions', sessionPayload({ averageScore: 140 }))).status).toBe(400);
    expect((await c.post('/api/sessions', sessionPayload({ grade: 'Z' }))).status).toBe(400);
  });

  it('rejects duplicate session ids', async () => {
    const { c } = await signup();
    await completeProfile(c);
    expect((await c.post('/api/sessions', sessionPayload({ id: 'dup' }))).status).toBe(202);
    expect((await c.post('/api/sessions', sessionPayload({ id: 'dup' }))).status).toBe(400);
  });

  it('requires a profile before saving', async () => {
    const { c } = await signup();
    await pool.query('DELETE FROM users');
    expect((await c.post('/api/sessions', sessionPayload())).status).toBe(400);
  });

  it('lists sessions newest first and deletes them', async () => {
    const { c, user } = await signup();
    await completeProfile(c);
    await c.post('/api/sessions', sessionPayload({ id: 'old', date: 1_000 }));
    await c.post('/api/sessions', sessionPayload({ id: 'new', date: 2_000 }));
    await whenIdle();

    const list = await c.get(`/api/users/${user.id}/sessions`);
    expect(list.body.map((s: any) => s.id)).toEqual(['new', 'old']);
    expect((await c.delete('/api/sessions/old')).status).toBe(204);
    expect((await c.get(`/api/users/${user.id}/sessions`)).body).toHaveLength(1);
  });

  it('retries a failed critique', async () => {
    const { c } = await signup();
    await completeProfile(c);
    await c.post('/api/sessions', sessionPayload({ id: 'fail-1' }));
    await whenIdle();
    await pool.query("UPDATE sessions SET critique_status = 'failed', ai_critique = NULL WHERE id = 'fail-1'");

    const retry = await c.post('/api/sessions/fail-1/critique/retry');
    expect(retry.status).toBe(202);
    await whenIdle();
    expect((await c.get('/api/sessions/fail-1')).body.critiqueStatus).toBe('ready');
    // only failed ones can be retried
    expect((await c.post('/api/sessions/fail-1/critique/retry')).status).toBe(400);
  });
});
