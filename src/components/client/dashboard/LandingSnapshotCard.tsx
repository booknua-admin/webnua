import { StatCard } from '@/components/shared/StatCard';
import type { LandingSnapshot } from '@/lib/dashboard/client-dashboard-types';
import { cn } from '@/lib/utils';

type LandingSnapshotCardProps = {
  snapshot: LandingSnapshot;
  className?: string;
};

/**
 * The landing-page snapshot on the client dashboard (Screen 1): a card header
 * (domain + status meta) over a 4-up grid of `StatCard`s.
 */
function LandingSnapshotCard({ snapshot, className }: LandingSnapshotCardProps) {
  return (
    <div
      data-slot="landing-snapshot-card"
      className={cn('rounded-xl border border-rule bg-card px-6 py-5', className)}
    >
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-extrabold tracking-[-0.015em] text-ink">
          Landing page · {snapshot.domain}
        </h2>
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink-quiet">
          {snapshot.meta}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-3.5">
        {snapshot.stats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            trend={stat.trend}
            trendTone={stat.trendTone}
          />
        ))}
      </div>
    </div>
  );
}

export { LandingSnapshotCard };
export type { LandingSnapshotCardProps };
