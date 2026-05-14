import { Eyebrow } from '@/components/ui/eyebrow';
import { cn } from '@/lib/utils';

type StatCardProps = {
  label: string;
  value: React.ReactNode;
  trend?: React.ReactNode;
  trendTone?: 'good' | 'quiet';
  className?: string;
};

function StatCard({
  label,
  value,
  trend,
  trendTone = 'good',
  className,
}: StatCardProps) {
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
    </div>
  );
}

export { StatCard };
