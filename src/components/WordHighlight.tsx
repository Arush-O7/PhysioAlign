import { useEffect, useRef, useState } from 'react';

// The landing page's one scroll moment: a statement whose words light up as its own
// section passes through the viewport. With reduced motion it's simply all lit.
export function WordHighlight({ text }: { text: string }) {
  const words = text.split(' ');
  const ref = useRef<HTMLParagraphElement>(null);
  const [lit, setLit] = useState(words.length);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 when the paragraph enters from the bottom, 1 once it reaches the upper third
      const progress = Math.min(1, Math.max(0, (vh - rect.top) / (vh * 0.66 + rect.height * 0.5)));
      setLit(Math.round(progress * words.length));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [words.length]);

  return (
    <p ref={ref} className="word-highlight">
      <span className="visually-hidden">{text}</span>
      {words.map((word, i) => (
        <span key={i} aria-hidden="true" className={i < lit ? 'is-lit' : undefined}>
          {word}{' '}
        </span>
      ))}
    </p>
  );
}
