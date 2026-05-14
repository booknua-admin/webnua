import { cn } from '@/lib/utils';
import type { FunnelArrow as FunnelArrowData } from '@/lib/funnels/types';

type FunnelArrowProps = {
  arrow: FunnelArrowData;
  className?: string;
};

function FunnelArrow({ arrow, className }: FunnelArrowProps) {
  return (
    <div
      data-slot="funnel-arrow"
      className={cn(
        'relative flex flex-col items-center justify-center',
        className,
      )}
    >
      <span className="z-10 mb-2 whitespace-nowrap rounded-pill bg-rust-soft px-2.5 py-1 font-mono text-[11px] font-extrabold tracking-[0.04em] text-rust">
        {arrow.pct}
      </span>
      <div className="relative h-[2px] w-full bg-rule">
        <span className="absolute -right-2 top-1/2 -translate-y-1/2 bg-white px-1 font-sans text-[16px] font-bold leading-none text-rust">
          →
        </span>
      </div>
      <span className="mt-2 font-mono text-[9px] font-bold uppercase tracking-[0.06em] text-ink-quiet [&_strong]:text-warn">
        {arrow.dropLabel}
      </span>
    </div>
  );
}

export { FunnelArrow };
export type { FunnelArrowProps };
