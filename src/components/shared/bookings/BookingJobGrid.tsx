import { cn } from '@/lib/utils';
import type { BookingJobCell } from '@/lib/bookings/types';

type BookingJobGridProps = {
  cells: BookingJobCell[];
  /** `paper` (client Screen 8): each cell sits in its own paper-bg tile.
   *  `plain` (admin Screen 18): cells are inline label/value pairs, no tile. */
  surface?: 'paper' | 'plain';
  className?: string;
};

function BookingJobGrid({
  cells,
  surface = 'paper',
  className,
}: BookingJobGridProps) {
  const isPaper = surface === 'paper';
  return (
    <div
      data-slot="booking-job-grid"
      data-surface={surface}
      className={cn(
        'grid grid-cols-2',
        isPaper ? 'gap-3.5' : 'gap-x-6 gap-y-4',
        className,
      )}
    >
      {cells.map((c, i) => (
        <div
          key={i}
          className={cn(
            isPaper && 'rounded-lg bg-paper px-3.5 py-3',
          )}
        >
          <div
            className={cn(
              'font-mono font-bold uppercase text-ink-quiet',
              isPaper
                ? 'mb-1 text-[9px] tracking-[0.12em]'
                : 'mb-1 text-[10px] tracking-[0.1em]',
            )}
          >
            {c.label}
          </div>
          <div
            className={cn(
              'text-ink [&_em]:not-italic [&_em]:text-rust',
              isPaper
                ? 'text-[14px] font-bold'
                : 'text-[14px] font-semibold',
            )}
          >
            {c.value}
          </div>
        </div>
      ))}
    </div>
  );
}

export { BookingJobGrid };
export type { BookingJobGridProps };
