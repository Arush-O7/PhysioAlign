// dev-only profiling counters, readable from the browser console:
//   __framesTotal       frames with a person detected
//   __framesDiscarded   of those, frames where some landmark had visibility < 0.6
//   __lat               per-frame processing time in ms (frame in to feedback out)
//   __mainLat           per-frame main thread time in ms (lower with the worker)
//   __perf()            prints median / p95 of both
// nothing is recorded in production builds, unless the url has ?perf
const enabled =
  !!(import.meta as any).env?.DEV ||
  (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('perf'));
const MAX_SAMPLES = 1000;
const w = (typeof window !== 'undefined' ? window : {}) as any;

const push = (key: string, value: number) => {
  w[key] = w[key] || [];
  w[key].push(value);
  if (w[key].length > MAX_SAMPLES) w[key].shift();
};

export const percentile = (values: number[], p: number) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
};

if (enabled) {
  w.__perf = () => {
    const lat = w.__lat || [];
    const main = w.__mainLat || [];
    const summary = {
      frames: lat.length,
      'processing median (ms)': +percentile(lat, 50).toFixed(1),
      'processing p95 (ms)': +percentile(lat, 95).toFixed(1),
      'main thread median (ms)': +percentile(main, 50).toFixed(1),
      'main thread p95 (ms)': +percentile(main, 95).toFixed(1),
    };
    console.table(summary);
    return summary;
  };
}

export function recordFrame(frame: { totalMs: number; mainThreadMs: number; lowVisibility: boolean }) {
  if (!enabled) return;
  w.__framesTotal = (w.__framesTotal || 0) + 1;
  if (frame.lowVisibility) w.__framesDiscarded = (w.__framesDiscarded || 0) + 1;
  push('__lat', frame.totalMs);
  push('__mainLat', frame.mainThreadMs);
}

export function logSaveTiming(ms: number, frames: number, payloadBytes: number) {
  if (!enabled) return;
  console.log(
    `[Performance] Session save: ${ms.toFixed(0)}ms | Payload: ${frames} frames (${(payloadBytes / 1024).toFixed(1)} KB)`
  );
}
