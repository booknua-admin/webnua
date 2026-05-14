import { cn } from '@/lib/utils';
import type { RecurringPreviewRow } from '@/lib/bookings/recurring-setup';

type RecurringPreviewListProps = {
  /** Mono eyebrow at the top — `<strong>` = rust */
  heading: React.ReactNode;
  rows: RecurringPreviewRow[];
  className?: string;
};

function RecurringPreviewList({
  heading,
  rows,
  className,
}: RecurringPreviewListProps) {
  return (
    <div
      data-slot="recurring-preview-list"
      className={cn(
        'rounded-[10px] border border-rule bg-paper px-5 py-4.5',
        className,
      )}
    >
      <div className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet [&_strong]:text-rust">
        {heading}
      </div>
      <div className="flex flex-col">
        {rows.map((r, i) => (
          <div
            key={i}
            className={cn(
              'grid grid-cols-[120px_1fr_90px] items-center gap-3 py-2',
              i < rows.length - 1 && 'border-b border-dotted border-rule-soft',
            )}
          >
            <span className="font-mono text-[12px] font-bold tracking-[0.02em] text-ink">
              {r.date}
            </span>
            <span className="text-[13px] text-ink">
              {r.time}{' '}
              <span className="text-[12px] text-ink-quiet">· {r.visit}</span>
            </span>
            <span className="text-right text-[13px] font-bold text-rust">
              {r.price}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export { RecurringPreviewList };
export type { RecurringPreviewListProps };
