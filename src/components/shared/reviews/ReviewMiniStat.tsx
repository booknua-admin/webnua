import { cn } from '@/lib/utils';

type ReviewMiniStatProps = {
  label: string;
  value: string;
  className?: string;
};

function ReviewMiniStat({ label, value, className }: ReviewMiniStatProps) {
  return (
    <div
      data-slot="review-mini-stat"
      className={cn('flex flex-col gap-1 text-left', className)}
    >
      <div className="text-[20px] font-extrabold leading-none tracking-[-0.025em] text-ink">
        {value}
      </div>
      <div className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
        {label}
      </div>
    </div>
  );
}

export { ReviewMiniStat };
export type { ReviewMiniStatProps };
