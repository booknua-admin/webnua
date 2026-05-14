import Link from 'next/link';

import { cn } from '@/lib/utils';
import type { LeadQuickAction } from '@/lib/leads/types';

type LeadQuickActionsProps = {
  actions: LeadQuickAction[];
  className?: string;
};

function LeadQuickActions({ actions, className }: LeadQuickActionsProps) {
  return (
    <div
      data-slot="lead-quick-actions"
      className={cn('flex flex-col gap-1.5', className)}
    >
      {actions.map((action) => (
        <LeadQuickActionItem key={action.label} action={action} />
      ))}
    </div>
  );
}

function LeadQuickActionItem({ action }: { action: LeadQuickAction }) {
  const classes = cn(
    'flex w-full items-center gap-2 rounded-[10px] border px-3 py-2.5 text-left text-[13px] transition-colors',
    action.primary
      ? 'border-rust bg-rust text-paper hover:bg-rust-light'
      : 'border-ink/10 bg-transparent text-ink hover:border-rust hover:text-rust',
  );

  const inner = (
    <>
      <span aria-hidden className="text-[14px]">
        {action.icon}
      </span>
      {action.label}
    </>
  );

  if (action.href) {
    return (
      <Link href={action.href} className={classes}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" className={classes}>
      {inner}
    </button>
  );
}

export { LeadQuickActions };
export type { LeadQuickActionsProps };
