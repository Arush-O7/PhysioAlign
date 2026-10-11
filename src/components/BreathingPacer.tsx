import { useEffect, useRef, useState } from 'react';
import { Wind } from 'lucide-react';

// Calming ratio used in most yoga classes: a slower exhale than inhale.
const INHALE_MS = 4000;
const HOLD_MS = 1000;
const EXHALE_MS = 6000;
const CYCLE_MS = INHALE_MS + HOLD_MS + EXHALE_MS;

type Phase = 'in' | 'hold' | 'out';

const PHASE_LABEL: Record<Phase, string> = {
  in: 'Breathe in',
  hold: 'Hold',
  out: 'Breathe out',
};

function phaseAt(elapsed: number): { phase: Phase; remaining: number } {
  const t = elapsed % CYCLE_MS;
  if (t < INHALE_MS) return { phase: 'in', remaining: INHALE_MS - t };
  if (t < INHALE_MS + HOLD_MS) return { phase: 'hold', remaining: INHALE_MS + HOLD_MS - t };
  return { phase: 'out', remaining: CYCLE_MS - t };
}

interface BreathingPacerProps {
  /** only paces while the session is actually running */
  active: boolean;
}

export function BreathingPacer({ active }: BreathingPacerProps) {
  const [enabled, setEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('physioalign:breathing') !== 'off';
    } catch {
      return true;
    }
  });
  const [{ phase, remaining }, setPhase] = useState(() => phaseAt(0));
  const startedAt = useRef<number>(performance.now());

  useEffect(() => {
    if (!active || !enabled) return;
    startedAt.current = performance.now();
    const timer = setInterval(() => {
      setPhase(phaseAt(performance.now() - startedAt.current));
    }, 100);
    return () => clearInterval(timer);
  }, [active, enabled]);

  const toggle = () => {
    setEnabled((on) => {
      try {
        localStorage.setItem('physioalign:breathing', on ? 'off' : 'on');
      } catch {
        // choice just won't persist
      }
      return !on;
    });
  };

  const running = active && enabled;
  // the ring follows the phase: expand on the inhale, stay full on the hold, shrink on the exhale
  const scale = phase === 'in' ? 1 : phase === 'hold' ? 1 : 0.62;
  const duration = phase === 'in' ? INHALE_MS : phase === 'hold' ? HOLD_MS : EXHALE_MS;

  return (
    <div
      className="plush"
      style={{
        padding: '16px 18px',
        background: 'var(--surface)',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'relative',
          width: 64,
          height: 64,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          className="breath-ring"
          style={{
            transform: running ? `scale(${scale})` : 'scale(0.8)',
            transitionDuration: running ? `${duration}ms` : '400ms',
            background: phase === 'out' ? 'var(--sky)' : 'var(--mint)',
          }}
        />
        <Wind size={20} style={{ position: 'relative', color: 'var(--ink)', strokeWidth: 2.5 }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--ink)' }}>
          {running ? PHASE_LABEL[phase] : 'Breathing pacer'}
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-soft)', marginTop: 2 }}>
          {running
            ? `${Math.ceil(remaining / 1000)}s · 4 in, 6 out`
            : enabled
              ? 'Starts when you begin the hold.'
              : 'Turned off.'}
        </div>
      </div>

      <button onClick={toggle} className="btn-plush ghost sm tap" aria-pressed={enabled}>
        {enabled ? 'Turn off' : 'Turn on'}
      </button>
    </div>
  );
}
