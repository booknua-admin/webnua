import { cn } from '@/lib/utils';
import type {
  BookingHistoryItemCompact,
  BookingHistoryItemGrid,
} from '@/lib/bookings/types';

type CompactProps = {
  variant: 'compact';
  item: BookingHistoryItemCompact;
  className?: string;
};

type GridProps = {
  variant: 'grid';
  item: BookingHistoryItemGrid;
  className?: string;
};

type BookingHistoryRowProps = CompactProps | GridProps;

function BookingHistoryRow(props: BookingHistoryRowProps) {
  if (props.variant === 'compact') {
    const { item, className } = props;
    return (
      <div
        data-slot="booking-history-row"
        data-variant="compact"
        className={cn(
          'rounded-lg bg-paper px-3.5 py-2.5 text-[13px] text-ink [&_strong]:font-bold',
          className,
        )}
      >
        <strong>{item.date}</strong> · {item.body}
      </div>
    );
  }

  const { item, className } = props;
  const isDone = item.status === 'done';
  const label = item.statusLabel ?? (isDone ? '✓ Done' : 'Scheduled');
  return (
    <div
      data-slot="booking-history-row"
      data-variant="grid"
      className={cn(
        'grid grid-cols-[100px_1fr_80px_auto] items-center gap-2.5 rounded-md bg-paper px-3.5 py-2.5 text-[13px]',
        className,
      )}
    >
      <span className="font-mono text-[11px] font-bold text-ink-quiet">
        {item.date}
      </span>
      <span className="text-ink">{item.title}</span>
      <span className="font-bold text-ink">{item.price}</span>
      <span
        className={cn(
          'text-[11px] font-bold',
          isDone ? 'text-good' : 'text-ink-quiet',
        )}
      >
        {label}
      </span>
    </div>
  );
}

export { BookingHistoryRow };
export type { BookingHistoryRowProps };
