import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { FunnelArrow } from '@/components/client/funnels/FunnelArrow';
import { FunnelPeriodToggle } from '@/components/client/funnels/FunnelPeriodToggle';
import { FunnelStepCard } from '@/components/client/funnels/FunnelStepCard';
import type {
  FunnelArrow as FunnelArrowData,
  FunnelPeriod,
  FunnelStep,
} from '@/lib/funnels/types';

type FunnelFlowProps = {
  title: ReactNode;
  steps: FunnelStep[];
  arrows: FunnelArrowData[];
  periods: FunnelPeriod[];
  defaultPeriod?: FunnelPeriod;
  /** Per-step editor deep-links, aligned to `steps` by index. When a step's
   *  entry is set, that step card becomes a link into the funnel-step
   *  editor. Omit (or leave entries undefined) for a static, non-clickable
   *  flow — e.g. for view-only users. */
  stepEditHrefs?: (string | undefined)[];
  className?: string;
};

function FunnelFlow({
  title,
  steps,
  arrows,
  periods,
  defaultPeriod,
  stepEditHrefs,
  className,
}: FunnelFlowProps) {
  return (
    <div
      data-slot="funnel-flow"
      className={cn(
        'rounded-[14px] border border-rule bg-card px-[30px] py-7',
        className,
      )}
    >
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-[17px] font-extrabold tracking-[-0.02em] text-ink [&_em]:not-italic [&_em]:text-rust">
          {title}
        </h2>
        <FunnelPeriodToggle periods={periods} defaultPeriod={defaultPeriod} />
      </div>

      <div className="grid grid-cols-[1fr_100px_1fr_100px_1fr] items-stretch">
        {steps.flatMap((step, idx) => {
          const arrow = arrows[idx];
          const nodes: ReactNode[] = [
            <FunnelStepCard
              key={step.id}
              step={step}
              editHref={stepEditHrefs?.[idx]}
            />,
          ];
          if (arrow) {
            nodes.push(<FunnelArrow key={arrow.id} arrow={arrow} />);
          }
          return nodes;
        })}
      </div>
    </div>
  );
}

export { FunnelFlow };
export type { FunnelFlowProps };
