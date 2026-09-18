import { beforeEach, describe, expect, it } from 'vitest';
import { client, completeProfile, hasDatabase, resetDatabase, sessionPayload, signup } from './helpers.js';

describe.skipIf(!hasDatabase)('access control', () => {
  beforeEach(resetDatabase);

  async function world() {
    const admin = await signup('admin', 'admin');
    const pat = await signup('patient', 'pat');
    const sam = await signup('patient', 'sam');
    const doc = await signup('doctor', 'doc');
    await completeProfile(pat.c);
    await completeProfile(sam.c);
    const saved = await pat.c.post('/api/sessions', sessionPayload({ id: 'pat-session' }));
    expect(saved.status).toBe(202);
    return { admin, pat, sam, doc };
  }

  it('keeps patients out of each other\'s data', async () => {
    const { pat, sam } = await world();
    expect((await pat.c.get(`/api/users/${pat.user.id}/sessions`)).body).toHaveLength(1);
    expect((await sam.c.get(`/api/users/${pat.user.id}`)).status).toBe(403);
    expect((await sam.c.get(`/api/users/${pat.user.id}/sessions`)).status).toBe(403);
    expect((await sam.c.get('/api/sessions/pat-session')).status).toBe(404);
    expect((await sam.c.delete('/api/sessions/pat-session')).status).toBe(404);
  });

  it('keeps patients and doctors out of admin routes', async () => {
    const { pat, doc } = await world();
    expect((await pat.c.get('/api/admin/users')).status).toBe(403);
    expect((await pat.c.get('/api/doctor/patients')).status).toBe(403);
    expect((await doc.c.get('/api/admin/users')).status).toBe(403);
  });

  it('gives a new doctor no access until approved', async () => {
    const { admin, pat, doc } = await world();
    expect(doc.user.approved).toBe(false);
    expect((await doc.c.get('/api/doctor/patients')).status).toBe(403);
    expect((await doc.c.get(`/api/users/${pat.user.id}`)).status).toBe(403);
    // unapproved doctors can't be assigned
    expect((await admin.c.put(`/api/admin/users/${pat.user.id}/doctor`, { doctorId: doc.user.id })).status).toBe(400);
    expect((await pat.c.post(`/api/admin/users/${doc.user.id}/approve`)).status).toBe(403);

    expect((await admin.c.post(`/api/admin/users/${doc.user.id}/approve`)).status).toBe(200);
    expect((await doc.c.get('/api/doctor/patients')).body).toEqual([]);
  });

  it('limits an approved doctor to assigned patients', async () => {
    const { admin, pat, sam, doc } = await world();
    await admin.c.post(`/api/admin/users/${doc.user.id}/approve`);

    expect((await doc.c.get(`/api/doctor/patients/${pat.user.id}/sessions`)).status).toBe(404);
    expect((await admin.c.put(`/api/admin/users/${pat.user.id}/doctor`, { doctorId: doc.user.id })).status).toBe(200);

    const list = (await doc.c.get('/api/doctor/patients')).body;
    expect(list.map((p: any) => p.id)).toEqual([pat.user.id]);
    expect(list[0]).toMatchObject({ sessionCount: 1, avgScore: 78 });

    const history = await doc.c.get(`/api/doctor/patients/${pat.user.id}/sessions`);
    expect(history.body[0]).toMatchObject({ id: 'pat-session', averageScore: 78, poseName: 'Tree Pose' });
    expect((await doc.c.get('/api/sessions/pat-session')).status).toBe(200);

    expect((await doc.c.get(`/api/users/${sam.user.id}`)).status).toBe(403);
    expect((await doc.c.put(`/api/doctor/patients/${sam.user.id}/care-plan`, { carePlan: [] })).status).toBe(404);

    const plan = [{ poseId: 'tree-pose', poseName: 'Tree Pose', targetHold: 20, frequency: 'Daily' }];
    expect((await doc.c.put(`/api/doctor/patients/${pat.user.id}/care-plan`, { carePlan: plan })).status).toBe(200);
    expect((await pat.c.get('/api/users/me')).body.carePlan).toEqual(plan);
    expect((await doc.c.post(`/api/doctor/patients/${pat.user.id}/insight`)).status).toBe(200);
  });

  it('validates care plans', async () => {
    const { admin, pat } = await world();
    const bad = await admin.c.put(`/api/doctor/patients/${pat.user.id}/care-plan`, { carePlan: [{ poseId: 'tree-pose', targetHold: 9999 }] });
    expect(bad.status).toBe(400);
  });

  it('lets admins see everyone and change roles, applying immediately', async () => {
    const { admin, pat } = await world();
    const users = (await admin.c.get('/api/admin/users')).body;
    expect(users).toHaveLength(4);
    expect(JSON.stringify(users)).not.toContain('password');
    expect((await admin.c.get('/api/doctor/patients')).body).toHaveLength(2);

    await admin.c.put(`/api/admin/users/${pat.user.id}/role`, { role: 'doctor' });
    expect((await pat.c.get('/api/doctor/patients')).status).toBe(200);
  });

  it('stops admins deleting themselves', async () => {
    const { admin } = await world();
    expect((await admin.c.delete(`/api/admin/users/${admin.user.id}`)).status).toBe(400);
  });

  it('does not let a profile update change the role', async () => {
    const { pat } = await world();
    await pat.c.put('/api/users/me', { name: 'Pat', age: 31, experience: 'advanced', goal: 'strength', role: 'admin' });
    expect((await pat.c.get('/api/users/me')).body).toMatchObject({ role: 'patient', age: 31 });
  });

  it('returns 404 for unknown api routes', async () => {
    const { pat } = await world();
    expect((await pat.c.get('/api/nope')).status).toBe(404);
  });

  it('reports health', async () => {
    const res = await client().get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, database: 'up' });
  });
});
