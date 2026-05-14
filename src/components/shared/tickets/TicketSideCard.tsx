import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type TicketSideCardProps = {
  heading: string;
  tone?: 'light' | 'dark';
  children: ReactNode;
  className?: string;
};

function TicketSideCard({
  heading,
  tone = 'light',
  children,
  className,
}: TicketSideCardProps) {
  const isDark = tone === 'dark';
  return (
    <div
      data-slot="ticket-side-card"
      data-tone={tone}
      className={cn(
        'rounded-[14px] px-5 py-[18px]',
        isDark
          ? 'bg-ink text-paper'
          : 'border border-ink/8 bg-card text-ink',
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
      {children}
    </div>
  );
}

export { TicketSideCard };
export type { TicketSideCardProps };
