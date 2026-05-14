import { cn } from '@/lib/utils';
import {
  CATEGORY_LABEL,
  STATUS_LABEL,
  URGENCY_LABEL,
  type TicketAwaiting,
  type TicketCategory,
  type TicketStatus,
  type TicketUrgency,
} from '@/lib/tickets/types';

const pillBase =
  'inline-flex items-center justify-center rounded-full font-mono text-[11px] font-bold uppercase tracking-[0.06em] px-2.5 py-1 whitespace-nowrap';

const STATUS_CLASS: Record<TicketStatus, string> = {
  open: 'bg-rust/12 text-rust',
  in_progress: 'bg-info/12 text-info',
  blocked: 'bg-warn/12 text-warn',
  done: 'bg-good/12 text-good',
};

type StatusPillProps = {
  status: TicketStatus;
  awaiting?: TicketAwaiting;
  /** When true, status `in_progress` + awaiting `client` renders as "Review". */
  reviewAware?: boolean;
  className?: string;
};

function StatusPill({
  status,
  awaiting,
  reviewAware = false,
  className,
}: StatusPillProps) {
  const isReview =
    reviewAware && status === 'in_progress' && awaiting === 'client';

  if (isReview) {
    return (
      <span
        data-slot="status-pill"
        data-status="review"
        className={cn(
          pillBase,
          'border border-rust bg-rust/18 text-rust',
          className,
        )}
      >
        Review
      </span>
    );
  }

  return (
    <span
      data-slot="status-pill"
      data-status={status}
      className={cn(pillBase, STATUS_CLASS[status], className)}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

const URGENCY_CLASS: Record<TicketUrgency, string> = {
  rush: 'bg-warn/12 text-warn',
  soon: 'bg-info/12 text-info',
  none: 'bg-paper-2 text-ink-quiet',
};

type UrgencyPillProps = {
  urgency: TicketUrgency;
  className?: string;
};

function UrgencyPill({ urgency, className }: UrgencyPillProps) {
  return (
    <span
      data-slot="urgency-pill"
      data-urgency={urgency}
      className={cn(pillBase, URGENCY_CLASS[urgency], className)}
    >
      {URGENCY_LABEL[urgency]}
    </span>
  );
}

const CATEGORY_CLASS: Record<TicketCategory, string> = {
  website: 'bg-rust/12 text-rust',
  marketing: 'bg-info/12 text-info',
  campaigns: 'bg-[#6b4ea6]/14 text-[#6b4ea6]',
  reviews: 'bg-[#c8941e]/14 text-[#a87618]',
  billing: 'bg-good/12 text-good',
  other: 'bg-paper-2 text-ink-quiet',
};

type CategoryPillProps = {
  category: TicketCategory;
  className?: string;
};

function CategoryPill({ category, className }: CategoryPillProps) {
  return (
    <span
      data-slot="category-pill"
      data-category={category}
      className={cn(pillBase, CATEGORY_CLASS[category], className)}
    >
      {CATEGORY_LABEL[category]}
    </span>
  );
}

type AttentionPillProps = {
  label: string;
  className?: string;
};

function AttentionPill({ label, className }: AttentionPillProps) {
  return (
    <span
      data-slot="attention-pill"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-rust px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-paper',
        className,
      )}
    >
      {label}
    </span>
  );
}

export { StatusPill, UrgencyPill, CategoryPill, AttentionPill };
export type {
  StatusPillProps,
  UrgencyPillProps,
  CategoryPillProps,
  AttentionPillProps,
};
