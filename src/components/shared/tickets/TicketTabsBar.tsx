'use client';

import { useState } from 'react';

import { cn } from '@/lib/utils';
import type { TicketTab } from '@/lib/tickets/types';

type TicketTabsBarProps = {
  tabs: TicketTab[];
  defaultActiveId?: string;
  /** Controlled active tab id. When provided, the bar surrenders local
   *  state and the parent owns activeId via onChange. */
  value?: string;
  onChange?: (id: string) => void;
  className?: string;
};

function TicketTabsBar({
  tabs,
  defaultActiveId,
  value,
  onChange,
  className,
}: TicketTabsBarProps) {
  const [internalActiveId, setInternalActiveId] = useState(
    defaultActiveId ?? tabs[0]?.id,
  );
  const isControlled = value !== undefined;
  const activeId = isControlled ? value : internalActiveId;

  const handleSelect = (id: string) => {
    if (!isControlled) setInternalActiveId(id);
    onChange?.(id);
  };

  return (
    <div
      data-slot="ticket-tabs-bar"
      role="tablist"
      className={cn('flex items-center gap-1.5', className)}
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
            onClick={() => handleSelect(tab.id)}
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

export { TicketTabsBar };
export type { TicketTabsBarProps };
