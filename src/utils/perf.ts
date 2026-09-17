// dev-only profiling counters, readable from the browser console:
//   __framesTotal, __framesDiscarded, __lat (last detection times in ms)
// nothing is recorded in production builds
const enabled = !!(import.meta as any).env?.DEV;
const MAX_SAMPLES = 300;
const w = window as any;

export function recordFrame(detectMs: number, lowVisibility: boolean) {
  if (!enabled) return;
  w.__framesTotal = (w.__framesTotal || 0) + 1;
  if (lowVisibility) w.__framesDiscarded = (w.__framesDiscarded || 0) + 1;
  w.__lat = w.__lat || [];
  w.__lat.push(detectMs);
  if (w.__lat.length > MAX_SAMPLES) w.__lat.shift();
}

export function logSaveTiming(ms: number, frames: number, payloadBytes: number) {
  if (!enabled) return;
  console.log(
    `[Performance] Session save + critique: ${ms.toFixed(0)}ms | Payload: ${frames} frames (${(payloadBytes / 1024).toFixed(1)} KB)`
  );
}
