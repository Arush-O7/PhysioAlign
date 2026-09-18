import { describe, expect, it } from 'vitest';
import { AngleSmoother, OneEuroFilter, Stabilizer } from './smoothing';

const stddev = (xs: number[]) => {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
};

describe('OneEuroFilter', () => {
  it('cuts jitter on a held pose', () => {
    const f = new OneEuroFilter();
    const raw: number[] = [];
    const out: number[] = [];
    for (let i = 0; i < 300; i++) {
      const value = 120 + (i % 2 ? 4 : -4); // +-4 degree alternating noise
      raw.push(value);
      out.push(f.filter(value, i * 33));
    }
    expect(stddev(out.slice(50))).toBeLessThan(stddev(raw.slice(50)) / 3);
  });

  it('still follows a real movement', () => {
    const f = new OneEuroFilter();
    for (let i = 0; i < 30; i++) f.filter(170, i * 33);
    let t = 30 * 33;
    let value = 0;
    // knee bends to 90 and stays there
    for (let i = 0; i < 15; i++) value = f.filter(90, (t += 33));
    expect(value).toBeLessThan(100);
  });

  it('starts from the first value', () => {
    expect(new OneEuroFilter().filter(42, 0)).toBe(42);
  });
});

describe('AngleSmoother', () => {
  it('keeps one filter per joint and rounds', () => {
    const s = new AngleSmoother();
    expect(s.smooth({ a: 10.4, b: 100.6 }, 0)).toEqual({ a: 10, b: 101 });
    s.reset();
    expect(s.smooth({ a: 50 }, 10)).toEqual({ a: 50 });
  });
});

describe('Stabilizer', () => {
  const make = () => new Stabilizer<{ k: string; n: number }>((v) => v.k, 250);

  it('ignores a category change shorter than the hold time', () => {
    const s = make();
    s.update({ k: 'ok', n: 1 }, 0);
    expect(s.update({ k: 'bad', n: 2 }, 100).k).toBe('ok');
    expect(s.update({ k: 'ok', n: 3 }, 200)).toEqual({ k: 'ok', n: 3 });
  });

  it('switches once the new category has held long enough', () => {
    const s = make();
    s.update({ k: 'ok', n: 1 }, 0);
    s.update({ k: 'bad', n: 2 }, 100);
    expect(s.update({ k: 'bad', n: 3 }, 360)).toEqual({ k: 'bad', n: 3 });
  });

  it('passes fresh values through while the category is unchanged', () => {
    const s = make();
    s.update({ k: 'ok', n: 1 }, 0);
    expect(s.update({ k: 'ok', n: 9 }, 10).n).toBe(9);
  });
});
