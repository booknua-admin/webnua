'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { TicketSideCard } from '@/components/shared/tickets/TicketSideCard';
import type { TicketStatus } from '@/lib/tickets/types';

type DisplayProps = {
  mode: 'display';
  status: TicketStatus;
  /** Headline status text. Wrap the highlighted word in `<em>` for rust-light. */
  statusLabel: ReactNode;
  description?: ReactNode;
  className?: string;
};

type PickProps = {
  mode: 'pick';
  options: { status: TicketStatus; label: string }[];
  activeStatus: TicketStatus;
  className?: string;
};

type TicketStatusCardProps = DisplayProps | PickProps;

function TicketStatusCard(props: TicketStatusCardProps) {
  if (props.mode === 'display') {
    return (
      <TicketSideCard heading="// Status" tone="dark" className={props.className}>
        <div className="mb-2.5 flex items-center gap-2.5">
          <span className="size-2.5 rounded-full bg-rust" />
          <div className="text-[16px] font-semibold [&_em]:not-italic [&_em]:text-rust-light">
            {props.statusLabel}
          </div>
        </div>
        {props.description ? (
          <div className="text-[12px] leading-[1.5] text-paper/65 [&_strong]:text-paper">
            {props.description}
          </div>
        ) : null}
      </TicketSideCard>
    );
  }

  return <StatusPicker {...props} />;
}

function StatusPicker({ options, activeStatus, className }: PickProps) {
  const [active, setActive] = useState<TicketStatus>(activeStatus);

  return (
    <TicketSideCard heading="// Status" tone="dark" className={className}>
      <div className="flex flex-col gap-1.5">
        {options.map((opt) => {
          const isActive = opt.status === active;
          return (
            <button
              key={opt.status}
              type="button"
              onClick={() => setActive(opt.status)}
              className={cn(
                'flex items-center justify-between rounded-[8px] px-3 py-2 text-left text-[13px] transition-colors',
                isActive
                  ? 'bg-paper/10 text-paper'
                  : 'text-paper/65 hover:bg-paper/5 hover:text-paper',
              )}
            >
              <span>{opt.label}</span>
              {isActive ? (
                <span className="font-mono text-[11px] text-rust-light">✓</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </TicketSideCard>
  );
}

export { TicketStatusCard };
export type { TicketStatusCardProps };
