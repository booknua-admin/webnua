import { cn } from '@/lib/utils';
import { FunnelStepThumbnail } from '@/components/client/funnels/FunnelStepThumbnail';
import type { FunnelStep } from '@/lib/funnels/types';

type FunnelStepCardProps = {
  step: FunnelStep;
  className?: string;
};

function FunnelStepCard({ step, className }: FunnelStepCardProps) {
  const isFirst = step.tone === 'first';
  const isLast = step.tone === 'last';
  const accent = isLast ? 'good' : 'rust';

  return (
    <div
      data-slot="funnel-step-card"
      data-tone={step.tone}
      className={cn(
        'group flex cursor-pointer flex-col rounded-[12px] border-[1.5px] px-5 py-[18px] transition-all',
        'hover:-translate-y-0.5 hover:shadow-card',
        isFirst &&
          'border-rust/30 bg-gradient-to-br from-rust-soft to-paper hover:border-rust',
        isLast &&
          'border-good/30 bg-gradient-to-br from-good-soft to-paper hover:border-good',
        !isFirst && !isLast && 'border-rule bg-paper hover:border-rust',
        className,
      )}
    >
      <div
        className={cn(
          'mb-2.5 inline-flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.1em]',
          accent === 'good' ? 'text-good' : 'text-rust',
        )}
      >
        <span
          className={cn(
            'inline-flex size-[22px] items-center justify-center rounded-full text-[11px] font-extrabold text-paper',
            accent === 'good' ? 'bg-good' : 'bg-rust',
          )}
        >
          {step.position}
        </span>
        {step.positionLabel}
      </div>

      <FunnelStepThumbnail variant={step.thumb} className="mb-3" />

      <div className="text-[15px] font-extrabold leading-tight tracking-[-0.02em] text-ink">
        {step.name}
      </div>
      <div className="mt-0.5 mb-3.5 font-mono text-[10px] tracking-[0.04em] text-ink-quiet">
        {step.url}
      </div>

      <div className="mb-2.5">
        <div
          className={cn(
            'text-[30px] font-extrabold leading-none tracking-[-0.03em] text-ink [&_em]:not-italic',
            accent === 'good' ? '[&_em]:text-good' : '[&_em]:text-rust',
          )}
        >
          {step.metricNum}
        </div>
        <div className="mt-1 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
          {step.metricLabel}
        </div>
      </div>

      <div className="mt-auto border-t border-dotted border-rule pt-3 font-mono text-[9px] tracking-[0.04em] text-ink-quiet">
        {step.foot.map((row) => (
          <div key={row.label} className="flex justify-between leading-[1.7]">
            <span className="uppercase">{row.label}</span>
            <strong className="font-bold text-ink">{row.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export { FunnelStepCard };
export type { FunnelStepCardProps };
