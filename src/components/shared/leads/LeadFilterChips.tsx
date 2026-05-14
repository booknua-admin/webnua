'use client';

import { useState } from 'react';

import { cn } from '@/lib/utils';
import type { LeadFilterChip } from '@/lib/leads/types';

type LeadFilterChipsProps = {
  label: string;
  chips: LeadFilterChip[];
  defaultActiveId?: string;
  className?: string;
};

function LeadFilterChips({
  label,
  chips,
  defaultActiveId,
  className,
}: LeadFilterChipsProps) {
  const [activeId, setActiveId] = useState(defaultActiveId ?? chips[0]?.id);

  return (
    <div
      data-slot="lead-filter-chips"
      className={cn('flex flex-wrap items-center gap-2', className)}
    >
      <span className="mr-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
        {label}
      </span>
      {chips.map((chip) => {
        const isActive = chip.id === activeId;
        return (
          <button
            key={chip.id}
            type="button"
            data-state={isActive ? 'active' : 'inactive'}
            onClick={() => setActiveId(chip.id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] transition-colors',
              isActive
                ? 'border-rust bg-rust text-paper'
                : 'border-rule bg-card text-ink-quiet hover:border-ink/30 hover:text-ink',
            )}
          >
            {chip.label}
            {typeof chip.count === 'number' ? (
              <span
                className={cn(
                  'rounded-full px-1.5 py-[1px] font-mono text-[10px]',
                  isActive ? 'bg-paper/15 text-paper' : 'bg-ink/8 text-ink-quiet',
                )}
              >
                {chip.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export { LeadFilterChips };
export type { LeadFilterChipsProps };
