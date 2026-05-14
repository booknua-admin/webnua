import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type LeadDetailHeaderProps = {
  avatar: string;
  name: string;
  metaParts: ReactNode[];
  clientPillLabel?: string;
  rightActions?: ReactNode;
  className?: string;
};

function LeadDetailHeader({
  avatar,
  name,
  metaParts,
  clientPillLabel,
  rightActions,
  className,
}: LeadDetailHeaderProps) {
  return (
    <div
      data-slot="lead-detail-header-row"
      className={cn('flex items-center gap-4 px-7 py-6', className)}
    >
      <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-paper-2 font-sans text-base font-extrabold text-ink">
        {avatar}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 truncate text-[20px] font-semibold text-ink tracking-[-0.01em]">
          {name}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-ink-quiet [&_strong]:font-semibold [&_strong]:text-ink">
          {metaParts.map((part, i) => (
            <span key={i} className="flex items-center gap-2">
              {i > 0 ? <span aria-hidden>·</span> : null}
              <span>{part}</span>
            </span>
          ))}
          {clientPillLabel ? (
            <span className="ml-1 inline-flex items-center rounded-full bg-paper-2 px-2 py-[2px] font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink">
              {clientPillLabel}
            </span>
          ) : null}
        </div>
      </div>
      {rightActions ? (
        <div className="flex shrink-0 items-center gap-2">{rightActions}</div>
      ) : null}
    </div>
  );
}

export { LeadDetailHeader };
export type { LeadDetailHeaderProps };
