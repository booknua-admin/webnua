'use client';

// =============================================================================
// AnalysisSplash — the paced "analysing…" screen between the signup-flow
// steps. Ink surface, a spinning glyph, lines that tick over one by one with a
// progress bar, then `onDone`. Used for both splash beats with different copy.
// =============================================================================

import { useEffect, useState } from 'react';

import { Eyebrow } from '@/components/ui/eyebrow';

type AnalysisSplashProps = {
  eyebrow: string;
  title: string;
  lines: string[];
  onDone: () => void;
  /** Per-line dwell, ms. */
  lineMs?: number;
};

function AnalysisSplash({
  eyebrow,
  title,
  lines,
  onDone,
  lineMs = 1400,
}: AnalysisSplashProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index >= lines.length) {
      const done = setTimeout(onDone, 600);
      return () => clearTimeout(done);
    }
    const next = setTimeout(() => setIndex((i) => i + 1), lineMs);
    return () => clearTimeout(next);
  }, [index, lines.length, lineMs, onDone]);

  const progress = Math.min(100, (index / lines.length) * 100);

  return (
    <div className="mx-auto w-full max-w-[620px] overflow-hidden rounded-2xl border border-ink bg-ink px-9 py-12 text-paper">
      <div className="mb-8 flex items-center gap-4">
        <span
          aria-hidden
          className="flex h-12 w-12 shrink-0 animate-spin items-center justify-center rounded-full bg-rust/[0.18] text-[24px] text-rust-light"
          style={{ animationDuration: '2.4s' }}
        >
          ✦
        </span>
        <div>
          <Eyebrow tone="rust">{eyebrow}</Eyebrow>
          <p className="mt-1 text-[22px] font-extrabold leading-[1.15] tracking-[-0.02em]">
            {title}
          </p>
        </div>
      </div>

      <div className="mb-7 h-1.5 overflow-hidden rounded-full bg-paper/12">
        <div
          className="h-full rounded-full bg-rust transition-[width] duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <ul className="space-y-2.5">
        {lines.map((line, i) => {
          const done = i < index;
          const active = i === index;
          return (
            <li
              key={line}
              className={`flex items-baseline gap-2.5 text-[14px] leading-[1.5] transition-opacity duration-300 ${
                done || active ? 'opacity-100' : 'opacity-35'
              }`}
            >
              <span
                aria-hidden
                className={
                  done
                    ? 'text-good'
                    : active
                      ? 'animate-pulse text-rust-light'
                      : 'text-paper/40'
                }
              >
                {done ? '✓' : active ? '◆' : '·'}
              </span>
              <span className={done ? 'text-paper/70' : 'text-paper/90'}>
                {line}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export { AnalysisSplash };
