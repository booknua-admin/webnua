import { cn } from '@/lib/utils';
import type { CampaignHeroData, CampaignHeroTone } from '@/lib/campaigns/types';

import { CampaignMetricTile } from './CampaignMetricTile';
import { CampaignPlainEnglish } from './CampaignPlainEnglish';

type CampaignHeroCardProps = {
  data: CampaignHeroData;
  className?: string;
};

// Status → colour mapping for the eyebrow dot + status pill. Tied to the
// campaign's lifecycle so a paused campaign doesn't render with the green
// "active" treatment.
const TONE_STYLES: Record<
  CampaignHeroTone,
  { dotBg: string; dotRing: string; pillBg: string; pillText: string; pillDot: string }
> = {
  active: {
    dotBg: 'bg-good',
    dotRing: 'shadow-[0_0_0_3px_var(--color-good-soft)]',
    pillBg: 'bg-good-soft',
    pillText: 'text-good',
    pillDot: 'bg-good',
  },
  paused: {
    dotBg: 'bg-ink-quiet',
    dotRing: 'shadow-[0_0_0_3px_var(--color-paper-2)]',
    pillBg: 'bg-paper-2',
    pillText: 'text-ink-quiet',
    pillDot: 'bg-ink-quiet',
  },
  pending: {
    dotBg: 'bg-warn',
    dotRing: 'shadow-[0_0_0_3px_var(--color-warn-soft,#fde8d8)]',
    pillBg: 'bg-warn-soft',
    pillText: 'text-warn',
    pillDot: 'bg-warn',
  },
  unknown: {
    dotBg: 'bg-ink-quiet',
    dotRing: 'shadow-[0_0_0_3px_var(--color-paper-2)]',
    pillBg: 'bg-paper-2',
    pillText: 'text-ink-quiet',
    pillDot: 'bg-ink-quiet',
  },
};

/**
 * Active-campaign hero card on client `/campaigns`. White card with header
 * row (eyebrow + name + meta + status pill), 4-tile metric grid with 1px
 * paper-2 separators, and a plain-English explainer card below the metrics.
 *
 * `data.statusTone` colour-keys the eyebrow dot + status pill (active →
 * green, paused → ink-quiet, pending → warn). Defaults to `unknown` (also
 * ink-quiet) so a campaign whose tone is unset doesn't visually lie.
 */
function CampaignHeroCard({ data, className }: CampaignHeroCardProps) {
  const tone = TONE_STYLES[data.statusTone ?? 'unknown'];
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
              className={cn('h-2 w-2 rounded-full', tone.dotBg, tone.dotRing)}
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
        <span
          className={cn(
            'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.1em]',
            tone.pillBg,
            tone.pillText,
          )}
        >
          <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', tone.pillDot)} />
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
