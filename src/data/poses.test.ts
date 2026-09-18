import { describe, expect, it } from 'vitest';
import { evaluatePose, getPoseById, POSES } from './poses';

const optimalAngles = (poseId: string) =>
  Object.fromEntries(Object.entries(getPoseById(poseId)!.targetAngles).map(([j, t]) => [j, t!.optimal]));

describe('evaluatePose', () => {
  it('gives a perfect score at the optimal angles for every linear pose', () => {
    const special = new Set(['tree-pose', 'warrior-i', 'warrior-ii']);
    for (const pose of POSES.filter((p) => !special.has(p.id))) {
      const result = evaluatePose(pose.id, optimalAngles(pose.id));
      expect(result.score, pose.id).toBe(100);
      expect(result.severity, pose.id).toBe('success');
    }
  });

  it('separates minor and major deviations', () => {
    const angles = optimalAngles('chair-pose');
    // chair pose left knee allows 90-125, errors start 15 past the edge
    const minor = evaluatePose('chair-pose', { ...angles, leftKnee: 145 });
    expect(minor.severity).toBe('warning');
    expect(minor.score).toBe(90);
    expect(minor.corrections[0]).toMatch(/^Left Knee Bend: Adjust slightly/);

    const major = evaluatePose('chair-pose', { ...angles, leftKnee: 160 });
    expect(major.severity).toBe('error');
    expect(major.score).toBe(80);
    expect(major.jointDeviations.leftKnee.error).toBe(true);
  });

  it('never goes below zero', () => {
    const wrecked = Object.fromEntries(Object.keys(optimalAngles('chair-pose')).map((j) => [j, 0]));
    expect(evaluatePose('chair-pose', wrecked).score).toBe(0);
  });

  it('works for tree pose on either leg, with hands overhead or in prayer', () => {
    const base = { leftHip: 170, rightHip: 120, leftElbow: 170, rightElbow: 170 };
    const leftStanding = { ...base, leftKnee: 175, rightKnee: 55, leftShoulder: 165, rightShoulder: 165 };
    const rightStanding = { ...base, leftKnee: 55, rightKnee: 175, leftShoulder: 30, rightShoulder: 30 };
    expect(evaluatePose('tree-pose', leftStanding).severity).toBe('success');
    expect(evaluatePose('tree-pose', rightStanding).severity).toBe('success');
  });

  it('works for warrior II facing either way', () => {
    const common = { leftShoulder: 90, rightShoulder: 90, leftElbow: 175, rightElbow: 175 };
    const leftFront = evaluatePose('warrior-ii', { ...common, leftKnee: 100, rightKnee: 170 });
    const rightFront = evaluatePose('warrior-ii', { ...common, leftKnee: 170, rightKnee: 100 });
    expect(leftFront.corrections).toEqual(rightFront.corrections.map((c) => c.replace('Right', 'Left')));
    expect(leftFront.score).toBe(rightFront.score);
  });

  it('handles an unknown pose', () => {
    expect(evaluatePose('nope', {}).score).toBe(0);
  });
});
