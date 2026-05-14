'use client';

import { useState } from 'react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type AdminTicketsFilterBarProps = {
  active: string[];
  available: string[];
  className?: string;
};

function AdminTicketsFilterBar({
  active,
  available,
  className,
}: AdminTicketsFilterBarProps) {
  const [search, setSearch] = useState('');

  return (
    <div
      data-slot="admin-tickets-filter-bar"
      className={cn('flex items-center gap-2', className)}
    >
      {active.map((label) => (
        <button
          key={label}
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full bg-rust px-3 py-1.5 text-[12px] font-semibold text-paper transition-colors hover:bg-rust-light"
        >
          {label}
          <span aria-hidden className="text-[14px] leading-none text-paper/80">
            ×
          </span>
        </button>
      ))}
      {available.map((label) => (
        <button
          key={label}
          type="button"
          className="inline-flex items-center rounded-full border border-rule bg-card px-3 py-1.5 text-[12px] text-ink-quiet transition-colors hover:border-ink/30 hover:text-ink"
        >
          {label}
        </button>
      ))}
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="⌕ Search tickets"
        className="h-9 w-[200px] rounded-full"
      />
    </div>
  );
}

export { AdminTicketsFilterBar };
export type { AdminTicketsFilterBarProps };
