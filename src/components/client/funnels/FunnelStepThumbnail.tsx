import { cn } from '@/lib/utils';
import type { FunnelStepThumbVariant } from '@/lib/funnels/types';

type FunnelStepThumbnailProps = {
  variant: FunnelStepThumbVariant;
  className?: string;
};

function FunnelStepThumbnail({ variant, className }: FunnelStepThumbnailProps) {
  if (variant === 'landing') {
    return (
      <div
        data-slot="funnel-step-thumbnail"
        data-variant="landing"
        className={cn(
          'flex h-16 flex-col items-center justify-center gap-1.5 overflow-hidden rounded-[8px] bg-gradient-to-br from-ink to-[#2c2620] px-2.5 text-paper',
          className,
        )}
      >
        <span className="text-[11px] font-extrabold leading-tight tracking-[-0.01em]">
          $99 EMERGENCY CALL-OUT
        </span>
        <span className="rounded-[4px] bg-rust px-2.5 py-1 text-[9px] font-bold text-paper">
          Get a sparky in 60 min →
        </span>
      </div>
    );
  }

  if (variant === 'schedule') {
    return (
      <div
        data-slot="funnel-step-thumbnail"
        data-variant="schedule"
        className={cn(
          'grid h-16 grid-cols-2 gap-1.5 overflow-hidden rounded-[8px] border border-rule-soft bg-paper p-2',
          className,
        )}
      >
        <div className="grid grid-cols-4 grid-rows-3 gap-[2px] rounded-[4px] bg-white p-1.5">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'rounded-[1px]',
                i === 2 || i === 7 ? 'bg-rust' : 'bg-paper-2',
              )}
            />
          ))}
        </div>
        <div className="flex flex-col justify-center gap-[3px] rounded-[4px] bg-white p-1.5">
          <div className="h-1.5 rounded-[1px] bg-paper-2" />
          <div className="h-1.5 rounded-[1px] bg-paper-2" />
          <div className="h-1.5 rounded-[1px] bg-paper-2" />
          <div className="mt-[3px] h-2 rounded-[2px] bg-rust" />
        </div>
      </div>
    );
  }

  return (
    <div
      data-slot="funnel-step-thumbnail"
      data-variant="thanks"
      className={cn(
        'relative flex h-16 items-center justify-center overflow-hidden rounded-[8px] border border-rule-soft bg-gradient-to-br from-good-soft to-[#c5e0c9]',
        className,
      )}
    >
      <span className="text-[28px] font-black leading-none text-good">✓</span>
      <span className="absolute bottom-1 text-[9px] font-extrabold tracking-[0.1em] text-good">
        BOOKED
      </span>
    </div>
  );
}

export { FunnelStepThumbnail };
export type { FunnelStepThumbnailProps };
