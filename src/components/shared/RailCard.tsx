import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { RailPropertyRow } from './RailPropertyRow';

/** Label/value row shorthand passed via `RailCard`'s `rows` prop. Structurally
 *  compatible with `lib/leads/types.ts` `LeadRailRow` — feature types stay put
 *  (same pattern as `FilterChips`). */
type RailRow = {
  label: string;
  value: ReactNode;
  accent?: boolean;
  tone?: 'good' | 'quiet' | 'default';
};

type RailCardProps = {
  heading: string;
  tone?: 'light' | 'dark';
  /** Shorthand: renders each row as a mono-labelled `RailPropertyRow`.
   *  For bespoke bodies (status pickers, action lists) pass `children`. */
  rows?: RailRow[];
  children?: ReactNode;
  className?: string;
};

function RailCard({ heading, tone = 'light', rows, children, className }: RailCardProps) {
  const isDark = tone === 'dark';
  return (
    <div
      data-slot="rail-card"
      data-tone={tone}
      className={cn(
        'rounded-[14px] px-5 py-[18px]',
        isDark ? 'bg-ink text-paper' : 'border border-ink/8 bg-card text-ink',
        className,
      )}
    >
      <div
        className={cn(
          'mb-3 font-mono text-[10px] font-bold uppercase tracking-[0.12em]',
          isDark ? 'text-paper/50' : 'text-ink/50',
        )}
      >
        {heading}
      </div>
      {rows ? (
        <div className="flex flex-col">
          {rows.map((row, i) => (
            <RailPropertyRow
              key={i}
              labelStyle="mono"
              label={row.label}
              value={row.value}
              tone={row.tone}
              accent={row.accent}
            />
          ))}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export { RailCard };
export type { RailCardProps, RailRow };
