import { cn } from '@/lib/utils';

type ConflictOptionRowProps = {
  num: string;
  title: string;
  sub: string;
  selected?: boolean;
  recommended?: boolean;
  onClick?: () => void;
  className?: string;
};

function ConflictOptionRow({
  num,
  title,
  sub,
  selected,
  recommended,
  onClick,
  className,
}: ConflictOptionRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-state={selected ? 'selected' : 'inactive'}
      data-slot="conflict-option-row"
      className={cn(
        'mb-2 grid w-full grid-cols-[28px_1fr] items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors last:mb-0',
        selected || recommended
          ? 'border-rust bg-rust-soft'
          : 'border-rule bg-paper hover:border-rust hover:bg-card',
        className,
      )}
    >
      <span className="flex h-5.5 w-5.5 items-center justify-center rounded-full bg-ink text-[11px] font-extrabold text-rust-light">
        {num}
      </span>
      <span className="text-[13px] text-ink">
        <strong className="font-bold">{title}</strong>
        <span className="mt-0.5 block text-[11px] text-ink-quiet">{sub}</span>
      </span>
    </button>
  );
}

export { ConflictOptionRow };
export type { ConflictOptionRowProps };
