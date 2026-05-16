import { cn } from '@/lib/utils';

type MiniTrendBarsProps = {
  /** Series, oldest → newest. The final point renders highlighted. */
  data: number[];
  /** Per-bar labels; defaults to a 4-point week series. */
  labels?: string[];
  className?: string;
};

const DEFAULT_LABELS = ['3W', '2W', 'LW', 'NOW'];

/**
 * A small bar sparkline — the `3W 2W LW NOW` mini-chart in the overview hub's
 * vs-prior stat cards. The final (newest) bar is rust-highlighted; the rest
 * sit in the rule colour.
 */
function MiniTrendBars({ data, labels = DEFAULT_LABELS, className }: MiniTrendBarsProps) {
  const max = Math.max(...data, 1);

  return (
    <div data-slot="mini-trend-bars" className={cn('flex items-end gap-1.5', className)}>
      {data.map((value, i) => {
        const isLast = i === data.length - 1;
        const heightPct = Math.max((value / max) * 100, 8);
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-8 w-full items-end">
              <div
                className={cn('w-full rounded-sm', isLast ? 'bg-rust' : 'bg-rule')}
                style={{ height: `${heightPct}%` }}
              />
            </div>
            <span className="font-mono text-[8px] font-bold uppercase tracking-[0.06em] text-ink-quiet">
              {labels[i] ?? ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export { MiniTrendBars };
export type { MiniTrendBarsProps };
