import { cn } from '@/lib/utils';

type RescheduleCompareCardProps = {
  /** `was` = dimmed paper card; `now` = rust-soft highlighted card. */
  tone: 'was' | 'now';
  tag: string;
  /** "13:30 — 15:30" */
  time: string;
  /** "Wed, May 13 · 2 hrs" */
  day: string;
  className?: string;
};

function RescheduleCompareCard({
  tone,
  tag,
  time,
  day,
  className,
}: RescheduleCompareCardProps) {
  const isNow = tone === 'now';
  return (
    <div
      data-slot="reschedule-compare-card"
      data-tone={tone}
      className={cn(
        'rounded-[10px] border px-5 py-4.5',
        isNow
          ? 'border-rust bg-rust-soft'
          : 'border-rule bg-paper opacity-65',
        className,
      )}
    >
      <div
        className={cn(
          'mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em]',
          isNow ? 'text-rust' : 'text-ink-quiet',
        )}
      >
        {tag}
      </div>
      <div className="mb-0.5 text-[22px] font-extrabold tracking-[-0.02em] text-ink">
        {time}
      </div>
      <div className="text-[14px] font-semibold text-ink-soft">{day}</div>
    </div>
  );
}

export { RescheduleCompareCard };
export type { RescheduleCompareCardProps };
