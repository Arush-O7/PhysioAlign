// One-Euro filter (Casiez et al., CHI 2012): a low-pass filter whose cutoff rises
// with speed. Holding still, it smooths hard and removes landmark jitter; moving,
// the cutoff goes up so the reading doesn't lag behind the body.
class LowPass {
  private y: number | null = null;

  filter(x: number, alpha: number) {
    this.y = this.y === null ? x : alpha * x + (1 - alpha) * this.y;
    return this.y;
  }

  last() {
    return this.y;
  }

  reset() {
    this.y = null;
  }
}

const alpha = (cutoffHz: number, dtSeconds: number) => {
  const tau = 1 / (2 * Math.PI * cutoffHz);
  return 1 / (1 + tau / dtSeconds);
};

export class OneEuroFilter {
  private x = new LowPass();
  private dx = new LowPass();
  private lastTime: number | null = null;

  constructor(
    private minCutoff = 1.2,
    private beta = 0.03,
    private derivativeCutoff = 1.0
  ) {}

  filter(value: number, timeMs: number) {
    if (this.lastTime === null || timeMs <= this.lastTime) {
      this.lastTime = timeMs;
      this.dx.filter(0, 1);
      return this.x.filter(value, 1);
    }
    const dt = (timeMs - this.lastTime) / 1000;
    this.lastTime = timeMs;

    const prev = this.x.last() ?? value;
    const speed = this.dx.filter((value - prev) / dt, alpha(this.derivativeCutoff, dt));
    const cutoff = this.minCutoff + this.beta * Math.abs(speed);
    return this.x.filter(value, alpha(cutoff, dt));
  }

  reset() {
    this.x.reset();
    this.dx.reset();
    this.lastTime = null;
  }
}

// one filter per joint
export class AngleSmoother {
  private filters = new Map<string, OneEuroFilter>();

  smooth(angles: Record<string, number>, timeMs: number): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [joint, value] of Object.entries(angles)) {
      let f = this.filters.get(joint);
      if (!f) {
        f = new OneEuroFilter();
        this.filters.set(joint, f);
      }
      out[joint] = Math.round(f.filter(value, timeMs));
    }
    return out;
  }

  reset() {
    this.filters.clear();
  }
}

// Debounces a categorical signal: a new category only replaces the shown one after it
// has held for holdMs. While the category stays the same, the latest value passes
// straight through, so numbers stay live and only the switching is delayed.
export class Stabilizer<T> {
  private current: { key: string; value: T } | null = null;
  private candidate: { key: string; since: number } | null = null;

  constructor(
    private keyOf: (value: T) => string,
    private holdMs = 250
  ) {}

  update(value: T, timeMs: number): T {
    const key = this.keyOf(value);
    if (!this.current || key === this.current.key) {
      this.current = { key, value };
      this.candidate = null;
      return value;
    }
    if (!this.candidate || this.candidate.key !== key) {
      this.candidate = { key, since: timeMs };
    }
    if (timeMs - this.candidate.since >= this.holdMs) {
      this.current = { key, value };
      this.candidate = null;
      return value;
    }
    return this.current.value;
  }

  reset() {
    this.current = null;
    this.candidate = null;
  }
}
