import { cn } from '@/lib/utils';

type ConflictCardProps = {
  /** `attempted` = rust-soft tint; `existing` = warn-soft tint. */
  tone: 'attempted' | 'existing';
  tag: string;
  time: string;
  detail: string;
  className?: string;
};

function ConflictCard({
  tone,
  tag,
  time,
  detail,
  className,
}: ConflictCardProps) {
  const isAttempted = tone === 'attempted';
  return (
    <div
      data-slot="conflict-card"
      data-tone={tone}
      className={cn(
        'rounded-[10px] border px-4 py-3.5',
        isAttempted
          ? 'border-rust bg-rust-soft'
          : 'border-warn bg-warn-soft',
        className,
      )}
    >
      <div
        className={cn(
          'mb-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em]',
          isAttempted ? 'text-rust' : 'text-warn',
        )}
      >
        {tag}
      </div>
      <div className="mb-0.5 text-[15px] font-extrabold leading-[1.2] text-ink">
        {time}
      </div>
      <div className="text-[12px] leading-[1.4] text-ink-soft">{detail}</div>
    </div>
  );
}

export { ConflictCard };
export type { ConflictCardProps };
