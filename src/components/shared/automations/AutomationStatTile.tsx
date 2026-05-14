import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type AutomationStatTileProps = {
  label: string;
  /** Inter Tight value. Wrap a span in `<em>` for rust highlight. */
  value: ReactNode;
  className?: string;
};

function AutomationStatTile({
  label,
  value,
  className,
}: AutomationStatTileProps) {
  return (
    <div
      data-slot="automation-stat-tile"
      className={cn(
        'flex flex-col gap-1 rounded-lg bg-paper px-3.5 py-3',
        className,
      )}
    >
      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
        {label}
      </div>
      <div className="font-sans text-[22px] font-extrabold leading-none tracking-[-0.02em] text-ink [&_em]:not-italic [&_em]:text-rust">
        {value}
      </div>
    </div>
  );
}

export { AutomationStatTile };
export type { AutomationStatTileProps };
