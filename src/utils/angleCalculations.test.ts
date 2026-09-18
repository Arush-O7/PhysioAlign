import { describe, expect, it } from 'vitest';
import { calculateAngles, getAngle, Keypoint } from './angleCalculations';

const p = (x: number, y: number, z = 0): Keypoint => ({ x, y, z, visibility: 1 });

describe('getAngle', () => {
  it('measures straight, right and folded joints', () => {
    expect(getAngle(p(0, 0), p(0, 1), p(0, 2))).toBe(180);
    expect(getAngle(p(0, 0), p(0, 1), p(1, 1))).toBe(90);
    expect(getAngle(p(0, 0), p(0, 1), p(0, 0))).toBe(0);
  });

  it('sees depth in 3d that a 2d projection misses', () => {
    // knee bent straight toward the camera: 2d looks straight, 3d is 90 degrees
    const hip = p(0, 0, 0);
    const knee = p(0, 1, 0);
    const ankle = p(0, 1.0001, -1);
    expect(getAngle(hip, knee, ankle, false)).toBe(180);
    expect(getAngle(hip, knee, ankle, true)).toBe(90);
  });

  it('returns 0 for coincident points instead of NaN', () => {
    expect(getAngle(p(1, 1), p(1, 1), p(2, 2))).toBe(0);
  });
});

describe('calculateAngles', () => {
  it('needs all 33 landmarks', () => {
    expect(calculateAngles([p(0, 0)])).toBeNull();
  });

  it('prefers world landmarks when given', () => {
    const flat = Array.from({ length: 33 }, () => p(0, 0));
    const world = Array.from({ length: 33 }, () => p(0, 0));
    // left hip 23, knee 25, ankle 27: bend the knee toward the camera in world space
    world[23] = p(0, 0, 0);
    world[25] = p(0, 1, 0);
    world[27] = p(0, 1, -1);
    expect(calculateAngles(flat, world)!.leftKnee).toBe(90);
    expect(Object.keys(calculateAngles(flat)!)).toHaveLength(10);
  });
});
