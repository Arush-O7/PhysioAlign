import { HOLD_SCORE_THRESHOLD, type SessionData } from '../game/types';

// Renders a shareable PNG of a finished session, drawn in the colours of the
// theme that's currently active so the card matches what the user sees.
const W = 1200;
const H = 630;

const token = (name: string, fallback: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** sticker panel: flat offset shadow plus outline, like the rest of the ui */
function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, line: string) {
  ctx.fillStyle = line;
  roundedRect(ctx, x + 5, y + 6, w, h, 20);
  ctx.fill();
  ctx.fillStyle = fill;
  roundedRect(ctx, x, y, w, h, 20);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = line;
  ctx.stroke();
}

const GRADE_TOKEN: Record<string, string> = {
  A: '--mint',
  B: '--mint',
  C: '--butter',
  F: '--rose',
};

export function drawSessionCard(session: SessionData): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  const cream = token('--cream', '#FFF6E6');
  const surface = token('--surface', '#FFFFFF');
  const line = token('--line', '#2B1E16');
  const ink = token('--ink', '#3B2A1F');
  const inkSoft = token('--ink-soft', '#7A6252');
  const peach = token('--peach-deep', '#FF8E5C');
  const mint = token('--mint-deep', '#5FCFA0');
  const grade = token(GRADE_TOKEN[session.grade] || '--butter', '#FFD86B');

  ctx.fillStyle = cream;
  ctx.fillRect(0, 0, W, H);

  // dotted backdrop, same texture as the app
  ctx.fillStyle = line;
  ctx.globalAlpha = 0.07;
  for (let y = 24; y < H; y += 34) {
    for (let x = 24; x < W; x += 34) {
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  panel(ctx, 56, 56, W - 122, H - 124, surface, line);

  ctx.fillStyle = inkSoft;
  ctx.font = '700 22px Nunito, system-ui, sans-serif';
  ctx.fillText('PHYSIOALIGN · SESSION REPORT', 96, 116);

  ctx.fillStyle = ink;
  ctx.font = '900 54px Nunito, system-ui, sans-serif';
  const title = session.poseName.replace(/\s*\(.*\)$/, '');
  ctx.fillText(title.length > 26 ? `${title.slice(0, 25)}…` : title, 96, 182);

  ctx.fillStyle = inkSoft;
  ctx.font = '700 22px Nunito, system-ui, sans-serif';
  ctx.fillText(
    new Date(session.date).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }),
    96,
    218
  );

  // grade badge
  panel(ctx, W - 250, 96, 140, 140, grade, line);
  ctx.fillStyle = ink;
  ctx.font = '900 86px Nunito, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(session.grade, W - 180, 196);
  ctx.textAlign = 'left';

  // stats
  const stats: [string, string][] = [
    ['ACCURACY', `${session.averageScore}%`],
    ['HOLD TIME', `${session.holdTimeSeconds}s`],
    ['DURATION', `${session.durationSeconds}s`],
  ];
  stats.forEach(([label, value], index) => {
    const x = 96 + index * 220;
    ctx.fillStyle = inkSoft;
    ctx.font = '800 18px Nunito, system-ui, sans-serif';
    ctx.fillText(label, x, 288);
    ctx.fillStyle = index === 1 ? mint : ink;
    ctx.font = '900 50px Nunito, system-ui, sans-serif';
    ctx.fillText(value, x, 338);
  });

  // score sparkline from the per-second log
  const logs = session.frameLogs || [];
  const chartX = 96;
  const chartY = 372;
  const chartW = W - 300;
  const chartH = 118;

  panel(ctx, chartX, chartY, chartW, chartH, cream, line);

  if (logs.length > 1) {
    const stepX = chartW / (logs.length - 1);
    // leave headroom so a flat 100% run doesn't sit on the panel edge
    const toY = (score: number) => chartY + chartH - (Math.max(0, Math.min(100, score)) / 100) * (chartH - 28) - 10;

    // keep the fill inside the rounded panel
    ctx.save();
    roundedRect(ctx, chartX, chartY, chartW, chartH, 20);
    ctx.clip();

    ctx.beginPath();
    ctx.moveTo(chartX, chartY + chartH);
    logs.forEach((log, i) => ctx.lineTo(chartX + i * stepX, toY(log.score)));
    ctx.lineTo(chartX + chartW, chartY + chartH);
    ctx.closePath();
    ctx.fillStyle = mint;
    ctx.globalAlpha = 0.3;
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.beginPath();
    logs.forEach((log, i) => {
      const x = chartX + i * stepX;
      const y = toY(log.score);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = line;
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // the line the score has to stay above for a second to count as a hold
    const thresholdY = toY(HOLD_SCORE_THRESHOLD);
    ctx.setLineDash([9, 7]);
    ctx.strokeStyle = peach;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(chartX, thresholdY);
    ctx.lineTo(chartX + chartW, thresholdY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    ctx.fillStyle = peach;
    ctx.font = '800 16px Nunito, system-ui, sans-serif';
    ctx.fillText(`hold ${HOLD_SCORE_THRESHOLD}%`, chartX + 14, thresholdY - 10);
  } else {
    ctx.fillStyle = inkSoft;
    ctx.font = '700 20px Nunito, system-ui, sans-serif';
    ctx.fillText('No per-second data for this session', chartX + 24, chartY + chartH / 2 + 8);
  }

  const footerY = chartY + chartH + 34;
  ctx.fillStyle = inkSoft;
  ctx.font = '700 20px Nunito, system-ui, sans-serif';
  ctx.fillText('Alignment accuracy, second by second', chartX, footerY);

  ctx.fillStyle = peach;
  ctx.font = '900 26px Nunito, system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('physioalign', W - 96, footerY);
  ctx.textAlign = 'left';

  return canvas;
}

export function downloadSessionCard(session: SessionData) {
  const canvas = drawSessionCard(session);
  const slug = session.poseName
    .toLowerCase()
    .replace(/\s*\(.*\)$/, '')
    .replace(/[^a-z0-9]+/g, '-');
  const date = new Date(session.date).toISOString().slice(0, 10);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `physioalign-${slug}-${date}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, 'image/png');
}
