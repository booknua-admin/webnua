import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import type {
  FunnelInsight,
  FunnelInsightTone,
} from '@/lib/funnels/types';

type FunnelInsightsCardProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  items: FunnelInsight[];
  className?: string;
};

function FunnelInsightsCard({
  title,
  subtitle,
  items,
  className,
}: FunnelInsightsCardProps) {
  return (
    <div
      data-slot="funnel-insights-card"
      className={cn(
        'rounded-[14px] border border-rule bg-card px-6 py-5',
        className,
      )}
    >
      <h3 className="mb-1 text-[15px] font-extrabold tracking-[-0.015em] text-ink [&_em]:not-italic [&_em]:text-rust">
        {title}
      </h3>
      {subtitle ? (
        <p className="mb-3.5 text-[12px] leading-[1.4] text-ink-quiet">
          {subtitle}
        </p>
      ) : null}

      <div>
        {items.map((item) => (
          <FunnelInsightRow key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

type FunnelInsightRowProps = {
  item: FunnelInsight;
};

function FunnelInsightRow({ item }: FunnelInsightRowProps) {
  return (
    <div
      data-slot="funnel-insight-row"
      className="grid grid-cols-[28px_1fr] items-start gap-3 border-b border-dotted border-rule-soft py-2.5 last:border-b-0"
    >
      <InsightIcon tone={item.tone} glyph={item.glyph} />
      <div>
        <div className="text-[13px] leading-[1.5] text-ink [&_em]:not-italic [&_em]:font-bold [&_em]:text-rust [&_strong]:font-bold">
          {item.body}
        </div>
        <div className="mt-1 font-mono text-[10px] font-bold uppercase tracking-[0.04em] text-ink-quiet">
          {item.meta}
        </div>
      </div>
    </div>
  );
}

function InsightIcon({
  tone,
  glyph,
}: {
  tone: FunnelInsightTone;
  glyph: string;
}) {
  return (
    <span
      data-slot="funnel-insight-icon"
      className={cn(
        'mt-0.5 inline-flex size-7 items-center justify-center rounded-full text-[13px] font-extrabold',
        tone === 'warn' && 'bg-warn/10 text-warn',
        tone === 'good' && 'bg-good/10 text-good',
        tone === 'info' && 'bg-rust-soft text-rust',
      )}
    >
      {glyph}
    </span>
  );
}

export { FunnelInsightsCard, FunnelInsightRow };
export type { FunnelInsightsCardProps, FunnelInsightRowProps };
