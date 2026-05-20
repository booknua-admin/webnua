'use client';

// =============================================================================
// GenerationSplash — the timed splash that runs while CreateClientModal is
// waiting on the real Claude generators (~60-90s end-to-end). V1 stages are
// hardcoded and timed — they reassure the user that work is happening, but
// they are NOT tied to real progress events. Real streaming is Session 6 work.
//
// The timing approximates the real generator: short opening stages (read,
// pick layouts) then longer copy-drafting stages. The final stage parks at
// "Almost ready" indefinitely so the splash never claims to be done before
// the real API call resolves.
// =============================================================================

import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

type Stage = {
  id: string;
  label: string;
  durationMs: number;
};

const STAGES: Stage[] = [
  { id: 'read', label: 'Reading your brief', durationMs: 3500 },
  { id: 'select', label: 'Selecting the best page layouts for your business', durationMs: 5500 },
  { id: 'home', label: 'Writing your home page copy', durationMs: 13000 },
  { id: 'pages', label: 'Drafting your about and services pages', durationMs: 13000 },
  { id: 'funnel', label: 'Building your funnel', durationMs: 16000 },
  // Final stage parks here — the real generation resolution unmounts the splash.
  { id: 'final', label: 'Almost ready', durationMs: 120000 },
];

export function GenerationSplash({ what }: { what: string }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (active >= STAGES.length - 1) return;
    const t = window.setTimeout(() => setActive((i) => i + 1), STAGES[active].durationMs);
    return () => window.clearTimeout(t);
  }, [active]);

  return (
    <div className="flex flex-col items-center gap-7 bg-paper px-6 py-12">
      <div className="relative flex h-14 w-14 items-center justify-center">
        <span
          className="absolute inset-0 animate-spin rounded-full border-2 border-rule border-t-rust"
          aria-hidden
        />
        <span className="text-[20px] text-rust" aria-hidden>
          ✦
        </span>
      </div>

      <div className="text-center">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-rust">
          {'// Generating'}
        </p>
        <p className="mt-1.5 text-[15px] font-semibold text-ink">
          Building {what} from your brief
        </p>
        <p className="mt-1 text-[12px] text-ink-quiet">
          This usually takes 60-90 seconds. Don&apos;t close the window.
        </p>
      </div>

      <ol className="flex w-full max-w-md flex-col gap-1.5" aria-label="Generation progress">
        {STAGES.map((s, i) => {
          const status: 'done' | 'active' | 'pending' =
            i < active ? 'done' : i === active ? 'active' : 'pending';
          return (
            <li
              key={s.id}
              aria-current={status === 'active' ? 'step' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-md px-3.5 py-2.5 transition-colors duration-300',
                status === 'active' && 'bg-rust-soft',
              )}
            >
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold leading-none transition-colors duration-300',
                  status === 'done' && 'border-good bg-good text-paper',
                  status === 'active' && 'animate-pulse border-rust bg-rust text-paper',
                  status === 'pending' && 'border-rule text-transparent',
                )}
                aria-hidden
              >
                {status === 'done' ? '✓' : status === 'active' ? '◆' : '·'}
              </span>
              <span
                className={cn(
                  'text-[13px] transition-colors duration-300',
                  status === 'done' && 'text-ink-mid line-through decoration-ink-quiet/40',
                  status === 'active' && 'font-semibold text-ink',
                  status === 'pending' && 'text-ink-quiet',
                )}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
