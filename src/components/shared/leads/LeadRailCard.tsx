import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import type { LeadRailRow } from '@/lib/leads/types';

type LeadRailCardProps = {
  heading: string;
  rows?: LeadRailRow[];
  children?: ReactNode;
  className?: string;
};

function LeadRailCard({
  heading,
  rows,
  children,
  className,
}: LeadRailCardProps) {
  return (
    <div
      data-slot="lead-rail-card"
      className={cn(
        'rounded-[14px] border border-ink/8 bg-card px-5 py-[18px]',
        className,
      )}
    >
      <div className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink/50">
        {heading}
      </div>
      {rows ? (
        <div className="flex flex-col">
          {rows.map((row, i) => (
            <LeadRailRowItem key={i} row={row} />
          ))}
        </div>
      ) : null}
      {children}
    </div>
  );
}

const ROW_TONE: Record<NonNullable<LeadRailRow['tone']>, string> = {
  good: 'text-good',
  quiet: 'text-ink-quiet',
  default: 'text-ink',
};

function LeadRailRowItem({ row }: { row: LeadRailRow }) {
  const valueClass = cn(
    'flex items-center gap-1.5 text-right text-[13px] font-semibold',
    row.tone ? ROW_TONE[row.tone] : 'text-ink',
    row.accent && 'text-rust',
  );

  return (
    <div className="flex items-center justify-between gap-3 border-b border-ink/6 py-[7px] text-[13px] last:border-b-0">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
        {row.label}
      </span>
      <span className={valueClass}>{row.value}</span>
    </div>
  );
}

export { LeadRailCard, LeadRailRowItem };
export type { LeadRailCardProps };
