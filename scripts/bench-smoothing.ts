// npm run bench:smoothing
// simulates a user holding chair pose with one knee right at the edge of the allowed
// range, plus landmark jitter, and counts how often the on-screen correction flips
import { evaluatePose, getPoseById, PoseFeedback } from '../src/data/poses';
import { AngleSmoother, Stabilizer } from '../src/utils/smoothing';

const FPS = 30;
const SECONDS = 60;
const NOISE_DEG = 3;

// seeded so the numbers are the same every run
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = rng(42);
const gaussian = () => Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());

const pose = getPoseById('chair-pose')!;
const optimal = Object.fromEntries(Object.entries(pose.targetAngles).map(([j, t]) => [j, t!.optimal]));
const keyOf = (f: PoseFeedback) => `${f.severity}|${(f.corrections[0] || '').split(':')[0]}`;

type Pipeline = (angles: Record<string, number>, t: number) => PoseFeedback;

function pipelines(): Record<string, Pipeline> {
  const smoother = new AngleSmoother();
  const smoother2 = new AngleSmoother();
  const stabilizer = new Stabilizer<PoseFeedback>(keyOf, 250);
  return {
    raw: (a) => evaluatePose(pose.id, a),
    smoothed: (a, t) => evaluatePose(pose.id, smoother.smooth(a, t)),
    'smoothed + stabilized': (a, t) => stabilizer.update(evaluatePose(pose.id, smoother2.smooth(a, t)), t),
  };
}

// 1) flicker: left knee drifts slowly around 140°, the edge of the error band (max 125 + 15)
const flips: Record<string, number> = {};
{
  const p = pipelines();
  const last: Record<string, string> = {};
  for (let i = 0; i < FPS * SECONDS; i++) {
    const t = (i * 1000) / FPS;
    const angles = { ...optimal };
    for (const j of Object.keys(angles)) angles[j] += gaussian() * NOISE_DEG;
    angles.leftKnee = 139 + 2 * Math.sin((2 * Math.PI * t) / 20000) + gaussian() * NOISE_DEG;
    for (const [name, run] of Object.entries(p)) {
      const key = keyOf(run(angles, t));
      if (last[name] !== undefined && last[name] !== key) flips[name] = (flips[name] ?? 0) + 1;
      last[name] = key;
    }
  }
}

// 2) responsiveness: knee goes from a good position to clearly wrong at t = 5s
const latency: Record<string, number> = {};
{
  const p = pipelines();
  const stepAt = 5000;
  for (let i = 0; i < FPS * 10; i++) {
    const t = (i * 1000) / FPS;
    const angles = { ...optimal };
    for (const j of Object.keys(angles)) angles[j] += gaussian() * NOISE_DEG;
    if (t >= stepAt) angles.leftKnee = 165 + gaussian() * NOISE_DEG;
    for (const [name, run] of Object.entries(p)) {
      // every pipeline sees every frame, only the timing check waits for the step
      const shown = run(angles, t);
      if (latency[name] === undefined && t >= stepAt && shown.severity === 'error') {
        latency[name] = Math.round(t - stepAt);
      }
    }
  }
}

console.log(`Chair pose, ${SECONDS}s at ${FPS} fps, ${NOISE_DEG}° landmark noise\n`);
console.log('pipeline                  flips/min   time to flag a real error');
for (const name of Object.keys(pipelines())) {
  console.log(`${name.padEnd(26)}${String(flips[name] ?? 0).padStart(9)}   ${String(latency[name]).padStart(6)} ms`);
}
const reduction = 1 - (flips['smoothed + stabilized'] ?? 0) / (flips.raw || 1);
console.log(`\nflicker reduced by ${(reduction * 100).toFixed(0)}% vs raw`);
