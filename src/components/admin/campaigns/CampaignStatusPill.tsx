import { cn } from '@/lib/utils';
import type { AdminCampaignStatus } from '@/lib/campaigns/types';

type CampaignStatusPillProps = {
  status: AdminCampaignStatus;
  /** Optional override; defaults to status-keyed label. */
  label?: string;
  className?: string;
};

const DEFAULT_LABEL: Record<AdminCampaignStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  pending: 'Pending',
};

/**
 * Mono uppercase pill used on admin `/campaigns` rows. `active` = good-green
 * with pulsing dot; `paused`/`pending` = ink-quiet with static dot. Distinct
 * vocabulary from existing tickets/leads status pills — kept as its own
 * component; revisit if a third campaign-status surface appears.
 */
function CampaignStatusPill({
  status,
  label,
  className,
}: CampaignStatusPillProps) {
  const isActive = status === 'active';
  return (
    <span
      data-slot="campaign-status-pill"
      data-status={status}
      className={cn(
        'inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.08em]',
        isActive ? 'text-good' : 'text-ink-quiet',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          isActive ? 'animate-pulse bg-good' : 'bg-ink-quiet',
        )}
      />
      {label ?? DEFAULT_LABEL[status]}
    </span>
  );
}

export { CampaignStatusPill };
export type { CampaignStatusPillProps };
