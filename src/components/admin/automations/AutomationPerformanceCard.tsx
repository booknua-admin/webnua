import type { AutomationPerformanceMetric } from '@/lib/automations/types';
import { cn } from '@/lib/utils';

type AutomationPerformanceCardProps = {
  heading: string;
  metrics: AutomationPerformanceMetric[];
  className?: string;
};

function AutomationPerformanceCard({
  heading,
  metrics,
  className,
}: AutomationPerformanceCardProps) {
  return (
    <div
      data-slot="automation-performance-card"
      className={cn(
        'rounded-[10px] border border-rule bg-card px-5 py-4.5',
        className,
      )}
    >
      <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
        {heading}
      </div>
      <div className="flex flex-col">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="flex items-center justify-between border-b border-paper-2 py-1.5 font-sans text-[13px] last:border-b-0"
          >
            <span className="text-ink-quiet">{metric.label}</span>
            <span
              className={cn(
                'font-semibold',
                metric.tone === 'accent' && 'text-rust',
                metric.tone === 'good' && 'text-good',
                (!metric.tone || metric.tone === 'default') && 'text-ink',
              )}
            >
              {metric.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export { AutomationPerformanceCard };
export type { AutomationPerformanceCardProps };
