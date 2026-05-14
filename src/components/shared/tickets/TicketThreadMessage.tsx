import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type TicketThreadMessageProps = {
  author: 'client' | 'operator';
  avatar: string;
  name: string;
  role: string;
  time: string;
  children: ReactNode;
  className?: string;
};

function TicketThreadMessage({
  author,
  avatar,
  name,
  role,
  time,
  children,
  className,
}: TicketThreadMessageProps) {
  const isOperator = author === 'operator';

  return (
    <div
      data-slot="ticket-thread-message"
      data-author={author}
      className={cn('grid grid-cols-[36px_1fr] items-start gap-3', className)}
    >
      <div
        className={cn(
          'flex size-9 items-center justify-center rounded-[10px] text-sm font-bold',
          isOperator ? 'bg-ink text-paper' : 'bg-paper-2 text-ink',
        )}
      >
        {avatar}
      </div>
      <div
        className={cn(
          'rounded-[12px] px-4 py-3.5 text-[14px] leading-[1.55]',
          isOperator
            ? 'bg-ink text-paper/92 [&_strong]:text-paper [&_em]:not-italic [&_em]:italic'
            : 'bg-paper-2 text-ink',
        )}
      >
        <div className="mb-2 flex items-center justify-between text-[12px]">
          <div className="flex items-center gap-1.5">
            <span className="font-bold">{name}</span>
            <span
              className={cn(
                'rounded-full px-2 py-[2px] font-mono text-[9px] font-bold uppercase tracking-[0.08em]',
                isOperator
                  ? 'bg-paper/12 text-paper/85'
                  : 'bg-ink/8 text-ink-quiet',
              )}
            >
              {role}
            </span>
          </div>
          <span
            className={cn(
              'font-mono text-[10px] uppercase tracking-[0.06em]',
              isOperator ? 'text-paper/50' : 'text-ink/45',
            )}
          >
            {time}
          </span>
        </div>
        <div className="[&_p]:m-0 [&_p:not(:last-child)]:mb-1.5">{children}</div>
      </div>
    </div>
  );
}

export { TicketThreadMessage };
export type { TicketThreadMessageProps };
