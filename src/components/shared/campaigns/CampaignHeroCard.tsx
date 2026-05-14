import { cn } from '@/lib/utils';
import type { CampaignHeroData } from '@/lib/campaigns/types';

import { CampaignMetricTile } from './CampaignMetricTile';
import { CampaignPlainEnglish } from './CampaignPlainEnglish';

type CampaignHeroCardProps = {
  data: CampaignHeroData;
  className?: string;
};

/**
 * Active-campaign hero card on client `/campaigns`. White card with header
 * row (eyebrow + name + meta + status pill), 4-tile metric grid with 1px
 * paper-2 separators, and a plain-English explainer card below the metrics.
 */
function CampaignHeroCard({ data, className }: CampaignHeroCardProps) {
  return (
    <div
      data-slot="campaign-hero-card"
      className={cn(
        'overflow-hidden rounded-[14px] border border-rule bg-card',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-paper-2 px-6 py-5">
        <div className="flex-1">
          <div className="mb-1.5 inline-flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-rust">
            <span
              aria-hidden
              className="h-2 w-2 rounded-full bg-good shadow-[0_0_0_3px_var(--color-good-soft)]"
            />
            {data.eyebrow}
          </div>
          <div className="mb-1 text-[22px] font-extrabold leading-[1.15] tracking-[-0.025em] text-ink [&_em]:not-italic [&_em]:text-rust">
            {data.name}
          </div>
          <p className="text-[13px] leading-[1.5] text-ink-quiet [&_strong]:font-semibold [&_strong]:text-ink">
            {data.meta}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-good-soft px-3.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-good">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-good" />
          {data.statusLabel}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-px bg-paper-2">
        {data.metrics.map((metric) => (
          <CampaignMetricTile
            key={metric.label}
            label={metric.label}
            value={metric.value}
            trend={metric.trend}
            trendTone={metric.trendTone}
          />
        ))}
      </div>
      <div className="px-6 py-5">
        <CampaignPlainEnglish>{data.plainEnglish}</CampaignPlainEnglish>
      </div>
    </div>
  );
}

export { CampaignHeroCard };
export type { CampaignHeroCardProps };
