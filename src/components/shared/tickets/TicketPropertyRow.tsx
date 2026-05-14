import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type TicketPropertyRowProps = {
  label: string;
  value: ReactNode;
  editable?: boolean;
  className?: string;
};

function TicketPropertyRow({
  label,
  value,
  editable = false,
  className,
}: TicketPropertyRowProps) {
  return (
    <div
      data-slot="ticket-property-row"
      className={cn(
        'flex items-center justify-between gap-3 border-b border-ink/6 py-[7px] text-[13px] last:border-b-0',
        className,
      )}
    >
      <span className="text-ink-quiet">{label}</span>
      <span className="flex items-center gap-1.5 font-semibold text-ink">
        {value}
        {editable ? (
          <span
            aria-hidden
            className="font-mono text-[11px] text-ink-quiet"
            title="Editable"
          >
            ✎
          </span>
        ) : null}
      </span>
    </div>
  );
}

export { TicketPropertyRow };
export type { TicketPropertyRowProps };
