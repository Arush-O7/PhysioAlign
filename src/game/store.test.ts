import { describe, expect, it } from 'vitest';
import { profileFromApi, screenForProfile } from './store';

describe('screenForProfile', () => {
  const base = profileFromApi({ name: 'A', age: 30, experience: 'beginner', goal: 'balance', role: 'patient' });

  it('routes each role to its home screen', () => {
    expect(screenForProfile(base)).toBe('dashboard');
    expect(screenForProfile({ ...base, role: 'admin' })).toBe('admin');
    expect(screenForProfile({ ...base, role: 'doctor', approved: true })).toBe('doctor');
  });

  it('holds unapproved doctors and sends incomplete patients to onboarding', () => {
    expect(screenForProfile({ ...base, role: 'doctor', approved: false })).toBe('pending');
    expect(screenForProfile({ ...base, age: null as unknown as number })).toBe('onboarding');
  });

  it('defaults a missing care plan to an empty list', () => {
    expect(base.carePlan).toEqual([]);
  });
});
