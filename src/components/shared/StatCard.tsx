import { Eyebrow } from '@/components/ui/eyebrow';
import { cn } from '@/lib/utils';

type StatCardProps = {
  label: string;
  value: React.ReactNode;
  trend?: React.ReactNode;
  trendTone?: 'good' | 'quiet';
  /** Optional visual rendered below the trend — e.g. a `MiniTrendBars`
   *  sparkline. Additive: it renders alongside value/trend, never replaces
   *  them. */
  chart?: React.ReactNode;
  className?: string;
};

function StatCard({ label, value, trend, trendTone = 'good', chart, className }: StatCardProps) {
  return (
    <div
      data-slot="stat-card"
      className={cn(
        'flex flex-col gap-2 rounded-lg border border-rule bg-card px-5 py-4',
        className,
      )}
    >
      <Eyebrow tone="quiet">{label}</Eyebrow>
      <div className="text-[30px] leading-none font-extrabold tracking-[-0.03em] text-ink [&_em]:not-italic [&_em]:text-rust">
        {value}
      </div>
      {trend ? (
        <div
          className={cn(
            'text-xs font-semibold',
            trendTone === 'good' ? 'text-good' : 'text-ink-quiet',
          )}
        >
          {trend}
        </div>
      ) : null}
      {chart ? <div className="mt-1">{chart}</div> : null}
    </div>
  );
}

export { StatCard };
