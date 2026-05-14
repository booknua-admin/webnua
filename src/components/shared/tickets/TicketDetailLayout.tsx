import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type TicketDetailLayoutProps = {
  main: ReactNode;
  side: ReactNode;
  className?: string;
};

function TicketDetailLayout({ main, side, className }: TicketDetailLayoutProps) {
  return (
    <div
      data-slot="ticket-detail-layout"
      className={cn(
        'grid grid-cols-[1fr_320px] items-start gap-[18px]',
        className,
      )}
    >
      <div className="min-w-0 overflow-hidden rounded-[14px] border border-ink/8 bg-card">
        {main}
      </div>
      <div className="flex flex-col gap-3.5">{side}</div>
    </div>
  );
}

export { TicketDetailLayout };
export type { TicketDetailLayoutProps };
