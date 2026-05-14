'use client';

import { useState } from 'react';

import { cn } from '@/lib/utils';
import type { LeadTab } from '@/lib/leads/types';

type LeadTabsBarProps = {
  tabs: LeadTab[];
  defaultActiveId?: string;
  className?: string;
};

function LeadTabsBar({ tabs, defaultActiveId, className }: LeadTabsBarProps) {
  const [activeId, setActiveId] = useState(defaultActiveId ?? tabs[0]?.id);

  return (
    <div
      data-slot="lead-tabs-bar"
      role="tablist"
      className={cn('flex flex-wrap items-center gap-1.5', className)}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-state={isActive ? 'active' : 'inactive'}
            onClick={() => setActiveId(tab.id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border border-transparent px-3.5 py-2 text-[13px] transition-colors',
              isActive
                ? 'bg-ink text-paper'
                : 'text-ink-quiet hover:text-ink',
            )}
          >
            {tab.label}
            {typeof tab.count === 'number' ? (
              <span
                className={cn(
                  'rounded-full px-[7px] py-[1px] font-mono text-[11px]',
                  isActive
                    ? 'bg-paper/15 text-paper'
                    : 'bg-ink/8 text-ink-quiet',
                )}
              >
                {tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export { LeadTabsBar };
export type { LeadTabsBarProps };
