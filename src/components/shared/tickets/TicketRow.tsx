import type { ReactNode } from 'react';
import Link from 'next/link';

import { cn } from '@/lib/utils';
import { CategoryTile } from '@/components/shared/tickets/CategoryTile';
import {
  AttentionPill,
  CategoryPill,
  StatusPill,
  UrgencyPill,
} from '@/components/shared/tickets/pills';
import { CATEGORY_LABEL } from '@/lib/tickets/types';
import type {
  TicketAwaiting,
  TicketCategory,
  TicketStatus,
  TicketUrgency,
} from '@/lib/tickets/types';
import type { AdminTicketClientTone } from '@/lib/tickets/admin-tickets';

type ClientTicketRowProps = {
  variant: 'client';
  title: string;
  preview: ReactNode;
  category: TicketCategory;
  status: TicketStatus;
  awaiting: TicketAwaiting;
  age: string;
  href: string;
};

type AdminTicketRowProps = {
  variant: 'admin';
  title: string;
  preview: string;
  category: TicketCategory;
  status: TicketStatus;
  urgency: TicketUrgency;
  age: string;
  unread?: boolean;
  client: {
    initial: string;
    name: string;
    meta: string;
    tone?: AdminTicketClientTone;
  };
  href: string;
};

type TicketRowProps = ClientTicketRowProps | AdminTicketRowProps;

const ADMIN_CLIENT_TONE_BG: Record<AdminTicketClientTone, string> = {
  voltline: 'bg-rust',
  freshhome: 'bg-[#2d4a3a]',
  keyhero: 'bg-[#6a5230]',
  flowline: 'bg-[#2d4a6a]',
  generic: 'bg-ink',
};

function clientAttention(
  status: TicketStatus,
  awaiting: TicketAwaiting,
): string | null {
  if (awaiting !== 'client') return null;
  if (status === 'open') return 'Reply needed';
  if (status === 'in_progress') return 'Draft ready';
  return null;
}

function TicketRow(props: TicketRowProps) {
  if (props.variant === 'client') {
    const attention = clientAttention(props.status, props.awaiting);
    const hasAttention = attention !== null;

    return (
      <Link
        href={props.href}
        data-slot="ticket-row"
        data-variant="client"
        data-attention={hasAttention || undefined}
        className={cn(
          'group grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-[18px] border-b border-ink/6 px-[22px] py-[18px] transition-colors last:border-b-0',
          hasAttention
            ? 'border-l-[3px] border-l-rust bg-rust/[0.04] pl-[19px] hover:bg-rust/[0.07]'
            : 'hover:bg-paper-2',
        )}
      >
        <CategoryTile category={props.category} />
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <div className="truncate text-[14px] font-semibold text-ink">
              {props.title}
            </div>
            {attention ? <AttentionPill label={attention} /> : null}
          </div>
          <div className="truncate text-[13px] text-ink-quiet [&_strong]:font-semibold [&_strong]:text-ink/85">
            {props.preview}
          </div>
        </div>
        <div className="font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-ink-quiet">
          {CATEGORY_LABEL[props.category]}
        </div>
        <StatusPill
          status={props.status}
          awaiting={props.awaiting}
          reviewAware
        />
        <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink/45">
          {props.age}
        </div>
      </Link>
    );
  }

  const hasAttention = !!props.unread;
  const toneBg = ADMIN_CLIENT_TONE_BG[props.client.tone ?? 'generic'];

  return (
    <Link
      href={props.href}
      data-slot="ticket-row"
      data-variant="admin"
      data-attention={hasAttention || undefined}
      className={cn(
        'group grid grid-cols-[20px_180px_1fr_110px_120px_110px_80px] items-center gap-3 border-b border-ink/6 px-[18px] py-4 transition-colors last:border-b-0',
        hasAttention
          ? 'border-l-[3px] border-l-rust bg-rust/[0.04] pl-[15px] hover:bg-rust/[0.07]'
          : 'hover:bg-paper-2',
      )}
    >
      <div
        aria-hidden
        className="size-3.5 rounded-[3px] border border-ink/20 group-hover:border-ink/40"
      />
      <div className="flex min-w-0 items-center gap-2.5">
        <div
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-[8px] font-sans text-sm font-extrabold text-paper',
            toneBg,
          )}
        >
          {props.client.initial}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-ink">
            {props.client.name}
          </div>
          <div className="truncate font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-ink-quiet">
            {props.client.meta}
          </div>
        </div>
      </div>
      <div className="min-w-0">
        <div className="mb-0.5 truncate text-[14px] font-semibold text-ink">
          {props.title}
        </div>
        <div className="truncate text-[12px] text-ink-quiet">
          {props.preview}
        </div>
      </div>
      <CategoryPill category={props.category} />
      <StatusPill status={props.status} />
      <UrgencyPill urgency={props.urgency} />
      <div className="text-right font-mono text-[11px] uppercase tracking-[0.06em] text-ink/45">
        {props.age}
      </div>
    </Link>
  );
}

export { TicketRow };
export type { TicketRowProps, ClientTicketRowProps, AdminTicketRowProps };
