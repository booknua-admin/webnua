import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type RailPropertyValueTone = 'good' | 'quiet' | 'default';

type RailPropertyRowProps = {
  label: string;
  value: ReactNode;
  /** Appends an inline ✎ glyph marking the row as editable. */
  editable?: boolean;
  /** Value colour. `accent` (rust) overrides `tone`. */
  tone?: RailPropertyValueTone;
  accent?: boolean;
  /** `plain` — quiet sentence-case label (tickets / bookings).
   *  `mono` — mono uppercase label (leads rail rows). */
  labelStyle?: 'plain' | 'mono';
  className?: string;
};

const VALUE_TONE: Record<RailPropertyValueTone, string> = {
  good: 'text-good',
  quiet: 'text-ink-quiet',
  default: 'text-ink',
};

function RailPropertyRow({
  label,
  value,
  editable = false,
  tone,
  accent = false,
  labelStyle = 'plain',
  className,
}: RailPropertyRowProps) {
  return (
    <div
      data-slot="rail-property-row"
      className={cn(
        'flex items-center justify-between gap-3 border-b border-ink/6 py-[7px] text-[13px] last:border-b-0',
        className,
      )}
    >
      <span
        className={cn(
          labelStyle === 'mono'
            ? 'font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-quiet'
            : 'text-ink-quiet',
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          'flex items-center gap-1.5 text-right font-semibold',
          tone ? VALUE_TONE[tone] : 'text-ink',
          accent && 'text-rust',
        )}
      >
        {value}
        {editable ? (
          <span aria-hidden className="font-mono text-[11px] text-ink-quiet" title="Editable">
            ✎
          </span>
        ) : null}
      </span>
    </div>
  );
}

export { RailPropertyRow };
export type { RailPropertyRowProps, RailPropertyValueTone };
