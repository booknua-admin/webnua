'use client';

import { useState } from 'react';

import { useUpdateLeadStatus } from '@/lib/leads/queries';
import { LEAD_STATUS_LABEL } from '@/lib/leads/types';
import type { LeadStatus } from '@/lib/leads/types';
import { cn } from '@/lib/utils';

type LeadStatusSwitcherProps = {
  leadId: string;
  defaultStatus: LeadStatus;
  className?: string;
  label?: string;
};

const STATUSES: LeadStatus[] = [
  'new',
  'contacted',
  'booked',
  'completed',
  'lost',
];

function LeadStatusSwitcher({
  leadId,
  defaultStatus,
  className,
  label = '// STATUS',
}: LeadStatusSwitcherProps) {
  const [status, setStatus] = useState<LeadStatus>(defaultStatus);
  const update = useUpdateLeadStatus();

  function handlePick(next: LeadStatus) {
    if (next === status || update.isPending) return;
    const previous = status;
    setStatus(next);
    update.mutate(
      { leadId, status: next },
      { onError: () => setStatus(previous) },
    );
  }

  return (
    <div
      data-slot="lead-status-switcher"
      className={cn(
        'flex flex-wrap items-center gap-2 border-b border-ink/6 px-7 py-3.5',
        className,
      )}
    >
      <span className="mr-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
        {label}
      </span>
      {STATUSES.map((s) => {
        const isActive = s === status;
        return (
          <button
            key={s}
            type="button"
            data-state={isActive ? 'active' : 'inactive'}
            disabled={update.isPending}
            onClick={() => handlePick(s)}
            className={cn(
              'inline-flex items-center rounded-full border px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] transition-colors disabled:cursor-not-allowed disabled:opacity-60',
              isActive
                ? 'border-ink bg-ink text-paper'
                : 'border-rule bg-card text-ink-quiet hover:border-ink/30 hover:text-ink',
            )}
          >
            {LEAD_STATUS_LABEL[s]}
          </button>
        );
      })}
    </div>
  );
}

export { LeadStatusSwitcher };
export type { LeadStatusSwitcherProps };
