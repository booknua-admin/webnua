import { cn } from '@/lib/utils';
import type { ReschedulePreviewToken } from '@/lib/bookings/reschedule-modal';

type RescheduleSmsPreviewProps = {
  /** Mono eyebrow heading — e.g. "PREVIEW · SMS TO CUSTOMER" */
  heading: string;
  tokens: ReschedulePreviewToken[];
  className?: string;
};

function RescheduleSmsPreview({
  heading,
  tokens,
  className,
}: RescheduleSmsPreviewProps) {
  return (
    <div
      data-slot="reschedule-sms-preview"
      className={cn(
        'rounded-[10px] border border-rule bg-card px-4.5 py-4',
        className,
      )}
    >
      <div className="mb-2.5 inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-rust" />
        {heading}
      </div>
      <div className="rounded-md border-l-[3px] border-good bg-paper px-3.5 py-3 text-[13px] leading-[1.5] text-ink">
        {tokens.map((t, i) =>
          t.type === 'var' ? (
            <span
              key={i}
              className="rounded bg-rust/[0.12] px-1.5 py-[1px] font-mono text-[11px] font-semibold text-rust"
            >
              {t.value}
            </span>
          ) : (
            <span key={i}>{t.value}</span>
          ),
        )}
      </div>
    </div>
  );
}

export { RescheduleSmsPreview };
export type { RescheduleSmsPreviewProps };
