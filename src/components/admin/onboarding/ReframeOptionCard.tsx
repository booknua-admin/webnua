'use client';

import { cn } from '@/lib/utils';

type ReframeOptionCardProps = {
  tag: string;
  text: React.ReactNode;
  reason: string;
  selected: boolean;
  onSelect: () => void;
};

function ReframeOptionCard({
  tag,
  text,
  reason,
  selected,
  onSelect,
}: ReframeOptionCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      data-slot="reframe-option"
      data-selected={selected}
      className={cn(
        'group block w-full cursor-pointer rounded-[10px] border bg-card px-5 py-4.5 text-left transition-all hover:border-rust',
        selected
          ? 'border-2 border-rust bg-rust-soft/60 px-[19px] py-[17px]'
          : 'border-rule',
      )}
    >
      <div
        data-slot="reframe-option-tag"
        className={cn(
          'mb-2.5 flex items-center justify-between font-mono text-[10px] font-bold uppercase tracking-[0.14em]',
          selected ? 'text-rust' : 'text-ink-quiet',
        )}
      >
        <span>{tag}</span>
        {selected ? (
          <span className="rounded-full bg-rust px-2 py-0.5 text-[9px] font-bold text-paper">
            SELECTED
          </span>
        ) : null}
      </div>
      <div
        data-slot="reframe-option-text"
        className="mb-2 font-sans text-[22px] font-extrabold leading-[1.15] tracking-[-0.025em] text-ink [&_em]:font-bold [&_em]:italic [&_em]:text-rust"
      >
        {text}
      </div>
      <div className="font-sans text-[13px] leading-[1.45] text-ink-quiet">
        {reason}
      </div>
    </button>
  );
}

export { ReframeOptionCard };
