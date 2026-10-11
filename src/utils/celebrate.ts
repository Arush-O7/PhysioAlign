// A short confetti burst for the moment a hold target is reached.
// Canvas is created on demand, removed when the animation ends, and skipped
// entirely when the user has asked for reduced motion.
const COLOURS = ['--peach-deep', '--butter', '--mint-deep', '--sky-deep', '--rose-deep'];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  spin: number;
  size: number;
  colour: string;
}

export function celebrate(durationMs = 1400) {
  if (typeof window === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  const styles = getComputedStyle(document.documentElement);
  const palette = COLOURS.map((token) => styles.getPropertyValue(token).trim() || '#FFB68A');

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2000';
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    return;
  }
  ctx.scale(dpr, dpr);

  const width = window.innerWidth;
  const originX = width / 2;
  const originY = window.innerHeight * 0.3;

  const particles: Particle[] = Array.from({ length: 90 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 7;
    return {
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3,
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.3,
      size: 6 + Math.random() * 6,
      colour: palette[Math.floor(Math.random() * palette.length)],
    };
  });

  const start = performance.now();
  let frame = 0;

  const tick = (now: number) => {
    const elapsed = now - start;
    const progress = elapsed / durationMs;
    ctx.clearRect(0, 0, width, window.innerHeight);

    particles.forEach((p) => {
      p.vy += 0.28; // gravity
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.spin;

      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - progress);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.colour;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    });

    if (elapsed < durationMs) {
      frame = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(frame);
      canvas.remove();
    }
  };

  frame = requestAnimationFrame(tick);
}
