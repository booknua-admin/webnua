import { cn } from '@/lib/utils';

type NegativeReviewActionRowProps = {
  num: string;
  title: string;
  sub: string;
  recommended?: boolean;
  onClick?: () => void;
  className?: string;
};

/**
 * Numbered suggested-action row on the admin negative-review modal
 * (admin Screen 24). Structurally close to `shared/bookings/ConflictOptionRow`
 * but adds a visible "Recommended" pill column. Parked-decision: extract a
 * generic numbered-option-row shared primitive if a third instance lands.
 */
function NegativeReviewActionRow({
  num,
  title,
  sub,
  recommended,
  onClick,
  className,
}: NegativeReviewActionRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-slot="negative-review-action-row"
      data-recommended={recommended ? 'true' : 'false'}
      className={cn(
        'grid w-full grid-cols-[24px_1fr_auto] items-center gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors',
        recommended
          ? 'border-rust bg-rust-soft'
          : 'border-rule bg-paper hover:border-rust hover:bg-card',
        className,
      )}
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-[12px] font-extrabold text-rust-light">
        {num}
      </span>
      <span className="flex flex-col gap-0.5 text-ink">
        <span className="text-[13px] font-bold">{title}</span>
        <span className="text-[12px] leading-[1.3] text-ink-quiet">{sub}</span>
      </span>
      {recommended ? (
        <span className="rounded-full bg-card px-2 py-[3px] font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-rust">
          Recommended
        </span>
      ) : (
        <span aria-hidden />
      )}
    </button>
  );
}

export { NegativeReviewActionRow };
export type { NegativeReviewActionRowProps };
