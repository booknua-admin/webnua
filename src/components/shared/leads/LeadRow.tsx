import Link from 'next/link';

import { cn } from '@/lib/utils';
import {
  LeadClientPill,
  LeadStatusPill,
  LeadUrgencyPill,
} from '@/components/shared/leads/pills';
import type {
  LeadClientTone,
  LeadStatus,
  LeadUrgency,
} from '@/lib/leads/types';

type ClientLeadRowProps = {
  variant: 'client';
  initial: string;
  name: string;
  suburb: string;
  preview: string;
  status: LeadStatus;
  statusLabel?: string;
  urgency?: LeadUrgency;
  age: string;
  unread: boolean;
  href: string;
};

type AdminLeadRowProps = {
  variant: 'admin';
  initial: string;
  name: string;
  clientName: string;
  clientService: string;
  clientTone: LeadClientTone;
  preview: string;
  status: LeadStatus;
  statusLabel?: string;
  age: string;
  meta: string;
  metaTone: 'good' | 'rust' | 'quiet';
  unread: boolean;
  href: string;
};

type LeadRowProps = ClientLeadRowProps | AdminLeadRowProps;

const ADMIN_TONE_BG: Record<LeadClientTone, string> = {
  voltline: 'bg-rust',
  freshhome: 'bg-[#2d4a3a]',
  keyhero: 'bg-[#6a5230]',
  neatworks: 'bg-info',
  flowline: 'bg-[#2d4a6a]',
  generic: 'bg-ink',
};

const ADMIN_META_TONE: Record<AdminLeadRowProps['metaTone'], string> = {
  good: 'text-good',
  rust: 'text-rust',
  quiet: 'text-ink-quiet',
};

function LeadRow(props: LeadRowProps) {
  if (props.variant === 'client') {
    return (
      <Link
        href={props.href}
        data-slot="lead-row"
        data-variant="client"
        data-attention={props.unread || undefined}
        className={cn(
          'group grid grid-cols-[44px_1fr_auto_auto_70px] items-center gap-4 border-b border-ink/6 px-[22px] py-[18px] transition-colors last:border-b-0',
          props.unread
            ? 'border-l-[3px] border-l-rust bg-rust/[0.04] pl-[19px] hover:bg-rust/[0.07]'
            : 'hover:bg-paper-2',
        )}
      >
        <div className="flex size-11 items-center justify-center rounded-full bg-paper-2 font-sans text-sm font-extrabold text-ink">
          {props.initial}
        </div>
        <div className="min-w-0">
          <div className="mb-1 truncate text-[14px] font-semibold text-ink">
            {props.name}
          </div>
          <div className="truncate text-[13px] text-ink-quiet">
            <span className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-ink/55">
              {props.suburb} ·
            </span>{' '}
            {props.preview}
          </div>
        </div>
        <LeadStatusPill status={props.status} label={props.statusLabel} />
        {props.urgency ? <LeadUrgencyPill urgency={props.urgency} /> : <div />}
        <div className="text-right font-mono text-[11px] uppercase tracking-[0.06em] text-ink/45">
          {props.age}
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={props.href}
      data-slot="lead-row"
      data-variant="admin"
      data-attention={props.unread || undefined}
      className={cn(
        'group grid grid-cols-[36px_180px_1fr_110px_90px_100px] items-center gap-3 border-b border-ink/6 px-[18px] py-4 transition-colors last:border-b-0',
        props.unread
          ? 'border-l-[3px] border-l-rust bg-rust/[0.04] pl-[15px] hover:bg-rust/[0.07]'
          : 'hover:bg-paper-2',
      )}
    >
      <div
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full font-sans text-[13px] font-extrabold text-paper',
          ADMIN_TONE_BG[props.clientTone],
        )}
      >
        {props.initial}
      </div>
      <div className="min-w-0">
        <div className="mb-1 truncate text-[14px] font-semibold text-ink">
          {props.name}
        </div>
        <LeadClientPill
          name={props.clientName}
          service={props.clientService}
          tone={props.clientTone}
        />
      </div>
      <div className="min-w-0 truncate text-[13px] text-ink-quiet">
        {props.preview}
      </div>
      <LeadStatusPill status={props.status} label={props.statusLabel} />
      <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink/45">
        {props.age}
      </div>
      <div
        className={cn(
          'text-right font-mono text-[11px] font-bold uppercase tracking-[0.06em]',
          ADMIN_META_TONE[props.metaTone],
        )}
      >
        {props.meta}
      </div>
    </Link>
  );
}

export { LeadRow };
export type { LeadRowProps, ClientLeadRowProps, AdminLeadRowProps };
