'use client';

import { useState } from 'react';

import { cn } from '@/lib/utils';

type ChipOption<T extends string = string> = {
  id: T;
  label: string;
};

type ChipSelectorProps<T extends string = string> = {
  options: ChipOption<T>[];
  defaultId?: T;
  value?: T;
  onChange?: (id: T) => void;
  /** `pill` (default): Inter Tight pill chip, ink-active. Service-chip style.
   *  `mono`: small mono uppercase pill, ink-active. Day-picker style. */
  variant?: 'pill' | 'mono';
  /** `pill` defaults to `wrap`. `mono` is typically a flush `flex-1` row. */
  layout?: 'wrap' | 'flex';
  className?: string;
};

function ChipSelector<T extends string = string>({
  options,
  defaultId,
  value,
  onChange,
  variant = 'pill',
  layout,
  className,
}: ChipSelectorProps<T>) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState<T | undefined>(
    defaultId ?? options[0]?.id,
  );
  const activeId = isControlled ? value : internal;
  const effectiveLayout = layout ?? (variant === 'mono' ? 'flex' : 'wrap');

  const handle = (id: T) => {
    if (!isControlled) setInternal(id);
    onChange?.(id);
  };

  return (
    <div
      data-slot="chip-selector"
      data-variant={variant}
      className={cn(
        'flex gap-1.5',
        effectiveLayout === 'wrap' ? 'flex-wrap' : 'flex-row',
        className,
      )}
    >
      {options.map((o) => {
        const isActive = o.id === activeId;
        const baseClasses = cn(
          'transition-colors',
          variant === 'pill'
            ? 'rounded-full border px-3.5 py-1.5 text-[13px] font-semibold'
            : 'flex-1 rounded-lg border px-1 py-3 text-center font-mono text-[11px] font-bold uppercase tracking-[0.08em]',
        );
        const stateClasses = isActive
          ? 'border-ink bg-ink text-paper'
          : variant === 'pill'
            ? 'border-rule bg-card text-ink-soft hover:border-rust'
            : 'border-rule bg-paper text-ink-quiet hover:border-rust';
        return (
          <button
            key={o.id}
            type="button"
            data-state={isActive ? 'active' : 'inactive'}
            onClick={() => handle(o.id)}
            className={cn(baseClasses, stateClasses)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export { ChipSelector };
export type { ChipOption, ChipSelectorProps };
