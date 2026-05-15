import { cn } from '@/lib/utils';

type CampaignSparklineProps = {
  /** Polyline points string, e.g. "0,30 14,28 28,24 ...". When omitted, a
   *  dashed flatline placeholder renders (used for pre-launch / pending rows). */
  points?: string;
  className?: string;
};

/**
 * Small inline SVG sparkline used on admin `/campaigns` rows. Rust stroke
 * with a soft rust fill below the line; dashed flat-line when there's no
 * data. Lives in `shared/` because it's generic enough to be reusable.
 */
function CampaignSparkline({ points, className }: CampaignSparklineProps) {
  return (
    <div
      data-slot="campaign-sparkline"
      className={cn(
        'h-10 overflow-hidden rounded-md border border-rule bg-paper',
        className,
      )}
    >
      <svg
        width="100%"
        height="40"
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        aria-hidden
      >
        {points ? (
          <>
            <polyline
              points={`${points} 100,40 0,40`}
              fill="rgba(210, 67, 23, 0.1)"
              stroke="none"
            />
            <polyline
              points={points}
              stroke="var(--color-rust)"
              strokeWidth="2"
              fill="none"
            />
          </>
        ) : (
          <line
            x1="0"
            y1="20"
            x2="100"
            y2="20"
            stroke="var(--color-rule)"
            strokeWidth="1"
            strokeDasharray="2,2"
          />
        )}
      </svg>
    </div>
  );
}

export { CampaignSparkline };
export type { CampaignSparklineProps };
