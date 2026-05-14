import { cn } from '@/lib/utils';
import {
  LEAD_STATUS_LABEL,
  LEAD_URGENCY_LABEL,
} from '@/lib/leads/types';
import type { LeadStatus, LeadUrgency } from '@/lib/leads/types';

const STATUS_STYLES: Record<LeadStatus, string> = {
  new: 'border-rust/40 bg-rust/[0.12] text-rust',
  contacted: 'border-info/40 bg-info/[0.12] text-info',
  booked: 'border-good/40 bg-good/[0.14] text-good',
  completed: 'border-ink/15 bg-ink/[0.08] text-ink',
  lost: 'border-rule bg-paper-2 text-ink-quiet',
};

const URGENCY_STYLES: Record<Exclude<LeadUrgency, 'none'>, string> = {
  asap: 'border-warn/40 bg-warn/[0.12] text-warn',
  today: 'border-warn/40 bg-warn/[0.12] text-warn',
  soon: 'border-ink/15 bg-paper-2 text-ink-quiet',
};

type LeadStatusPillProps = {
  status: LeadStatus;
  label?: string;
  className?: string;
};

function LeadStatusPill({ status, label, className }: LeadStatusPillProps) {
  return (
    <span
      data-slot="lead-status-pill"
      data-status={status}
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-[3px] font-mono text-[10px] font-bold uppercase tracking-[0.08em]',
        STATUS_STYLES[status],
        className,
      )}
    >
      {label ?? LEAD_STATUS_LABEL[status]}
    </span>
  );
}

type LeadUrgencyPillProps = {
  urgency: LeadUrgency;
  className?: string;
};

function LeadUrgencyPill({ urgency, className }: LeadUrgencyPillProps) {
  if (urgency === 'none') return null;
  return (
    <span
      data-slot="lead-urgency-pill"
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-[3px] font-mono text-[10px] font-bold uppercase tracking-[0.08em]',
        URGENCY_STYLES[urgency],
        className,
      )}
    >
      {LEAD_URGENCY_LABEL[urgency]}
    </span>
  );
}

type LeadClientPillProps = {
  name: string;
  service?: string;
  tone?:
    | 'voltline'
    | 'freshhome'
    | 'keyhero'
    | 'neatworks'
    | 'flowline'
    | 'generic';
  className?: string;
};

const CLIENT_TONE_STYLES: Record<
  NonNullable<LeadClientPillProps['tone']>,
  string
> = {
  voltline: 'bg-rust/[0.12] text-rust',
  freshhome: 'bg-[#2d4a3a]/[0.10] text-[#2d4a3a]',
  keyhero: 'bg-[#6a5230]/[0.12] text-[#6a5230]',
  neatworks: 'bg-info/[0.10] text-info',
  flowline: 'bg-[#2d4a6a]/[0.10] text-[#2d4a6a]',
  generic: 'bg-ink/[0.06] text-ink-quiet',
};

function LeadClientPill({
  name,
  service,
  tone = 'generic',
  className,
}: LeadClientPillProps) {
  return (
    <span
      data-slot="lead-client-pill"
      className={cn(
        'inline-flex items-center rounded-full px-2 py-[2px] font-mono text-[10px] font-semibold uppercase tracking-[0.06em]',
        CLIENT_TONE_STYLES[tone],
        className,
      )}
    >
      {name}
      {service ? <span className="opacity-70">&nbsp;·&nbsp;{service}</span> : null}
    </span>
  );
}

export { LeadStatusPill, LeadUrgencyPill, LeadClientPill };
export type { LeadStatusPillProps, LeadUrgencyPillProps, LeadClientPillProps };
