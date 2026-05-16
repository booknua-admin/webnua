// =============================================================================
// SeatUsageMeter — "N of M seats used" indicator for a client business.
//
// Presentational only — takes a resolved SeatUsage (the caller fetches it
// reactively via useClientSeatUsage). Used on the client Team tab and inside
// the invite modal. When the limit is null (unconfigured) it renders an
// uncapped variant — no bar, just the count.
// =============================================================================

import type { SeatUsage } from '@/lib/invites/seats';
import { cn } from '@/lib/utils';

type SeatUsageMeterProps = {
  usage: SeatUsage;
  className?: string;
};

export function SeatUsageMeter({ usage, className }: SeatUsageMeterProps) {
  const { total, limit, usedByInvites } = usage;
  const capped = limit !== null;
  const atLimit = capped && total >= limit;
  const pct = capped && limit > 0 ? Math.min(100, (total / limit) * 100) : 0;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-ink-quiet">
          {capped ? (
            <>
              <strong className={cn('text-ink', atLimit && 'text-rust')}>
                {total}
              </strong>{' '}
              of <strong className="text-ink">{limit}</strong> seats used
            </>
          ) : (
            <>
              <strong className="text-ink">{total}</strong>{' '}
              {total === 1 ? 'seat' : 'seats'} used · no limit set
            </>
          )}
        </span>
        {usedByInvites > 0 ? (
          <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-quiet">
            {usedByInvites} pending
          </span>
        ) : null}
      </div>
      {capped ? (
        <div className="h-1.5 overflow-hidden rounded-full bg-paper-2">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              atLimit ? 'bg-rust' : 'bg-good',
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

export type { SeatUsageMeterProps };
