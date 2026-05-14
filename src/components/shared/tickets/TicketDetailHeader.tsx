import type { ReactNode } from 'react';
import Link from 'next/link';

import { cn } from '@/lib/utils';

type TicketDetailHeaderProps = {
  backHref: string;
  backLabel: string;
  pills: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  className?: string;
};

function TicketDetailHeader({
  backHref,
  backLabel,
  pills,
  title,
  meta,
  className,
}: TicketDetailHeaderProps) {
  return (
    <div
      data-slot="ticket-detail-header"
      className={cn('border-b border-ink/6 px-7 py-5', className)}
    >
      <Link
        href={backHref}
        className="mb-3.5 inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-ink-quiet transition-colors hover:text-rust"
      >
        <span aria-hidden>←</span>
        {backLabel}
      </Link>
      <div className="mb-2.5 flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-ink/45">
        {pills}
      </div>
      <h1 className="mb-2 text-[24px] font-semibold leading-tight tracking-[-0.015em] text-ink [&_em]:not-italic [&_em]:font-medium [&_em]:text-rust">
        {title}
      </h1>
      {meta ? (
        <div className="text-[12px] text-ink-quiet [&_strong]:font-semibold [&_strong]:text-ink">
          {meta}
        </div>
      ) : null}
    </div>
  );
}

type TicketIdLabelProps = {
  id: string;
  className?: string;
};

function TicketIdLabel({ id, className }: TicketIdLabelProps) {
  return (
    <span
      data-slot="ticket-id-label"
      className={cn('font-semibold text-ink/70', className)}
    >
      {id}
    </span>
  );
}

export { TicketDetailHeader, TicketIdLabel };
export type { TicketDetailHeaderProps };
