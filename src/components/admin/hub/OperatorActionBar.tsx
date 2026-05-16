import Link from 'next/link';

import type { OperatorAction } from '@/lib/dashboard/hub-types';
import { cn } from '@/lib/utils';

type OperatorActionBarProps = {
  actions: OperatorAction[];
  /** Renders the "viewing as operator" note that explains the bar is
   *  operator-only chrome. */
  note?: string;
  className?: string;
};

const DEFAULT_NOTE = 'Viewing as operator · the client sees this screen without this bar';

const CHIP_CLASS =
  'inline-flex items-center gap-1.5 rounded-md border border-rule bg-card ' +
  'px-2.5 py-1.5 text-[12px] font-semibold text-ink transition-colors ' +
  'hover:border-rust hover:text-rust';

/**
 * The `// OPERATOR ACTIONS` bar at the top of the single-client hub (Screen
 * 20). Operator-only chrome. Each action is typed by `OperatorAction.kind`
 * (vision §7) — a discrete, attributable operator event, ready for the
 * backend to log "operator did X on client Y".
 */
function OperatorActionBar({ actions, note = DEFAULT_NOTE, className }: OperatorActionBarProps) {
  return (
    <div
      data-slot="operator-action-bar"
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-[10px] border border-rule bg-paper-2 px-5 py-3',
        className,
      )}
    >
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-rust">
        {'// Operator actions'}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {actions.map((action) =>
          action.href ? (
            <Link key={action.kind} href={action.href} className={CHIP_CLASS}>
              <span aria-hidden>{action.icon}</span>
              {action.label}
            </Link>
          ) : (
            <button key={action.kind} type="button" className={CHIP_CLASS}>
              <span aria-hidden>{action.icon}</span>
              {action.label}
            </button>
          ),
        )}
      </div>
      <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
        {note}
      </span>
    </div>
  );
}

export { OperatorActionBar };
export type { OperatorActionBarProps };
