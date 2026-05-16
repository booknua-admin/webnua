'use client';

// =============================================================================
// PolicyOverrideRow — the canonical "inherited from agency / overridden here"
// affordance for sub-account settings (Cluster 8 · Session 4b).
//
// Wraps any control with: a label, an inherited/overridden source badge, the
// agency value as a hint when inherited, and a "Revert to agency" action when
// overridden. The control itself is `children` — the parent owns what
// "override" means for its policy key (a toggle, a number, …).
//
// `PolicySourceBadge` is exported standalone for surfaces that carry the same
// vocabulary without the full row (e.g. ClientSeatLimitCard).
// =============================================================================

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type PolicySource = 'inherited' | 'overridden';

export function PolicySourceBadge({ source }: { source: PolicySource }) {
  const overridden = source === 'overridden';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-pill px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em]',
        overridden ? 'bg-rust-soft text-rust' : 'bg-paper-2 text-ink-quiet',
      )}
    >
      {overridden ? 'Overridden' : 'Inherited'}
    </span>
  );
}

type PolicyOverrideRowProps = {
  label: string;
  description?: React.ReactNode;
  source: PolicySource;
  /** Shown next to the badge when inherited — typically the agency value. */
  agencyHint?: React.ReactNode;
  /** Revert to the inherited agency value. Rendered only when overridden. */
  onRevert?: () => void;
  children: React.ReactNode;
  className?: string;
};

export function PolicyOverrideRow({
  label,
  description,
  source,
  agencyHint,
  onRevert,
  children,
  className,
}: PolicyOverrideRowProps) {
  const overridden = source === 'overridden';
  return (
    <div
      className={cn(
        'border-b border-dotted border-rule-soft pb-4 last:border-b-0 last:pb-0',
        className,
      )}
    >
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-bold text-ink">{label}</span>
          <PolicySourceBadge source={source} />
          {!overridden && agencyHint != null ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
              {agencyHint}
            </span>
          ) : null}
        </div>
        {overridden && onRevert ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRevert}
            className="-my-1 h-auto shrink-0 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-rust hover:bg-rust/10"
          >
            Revert to agency
          </Button>
        ) : null}
      </div>
      {description ? (
        <div className="mb-2.5 text-[13px] leading-[1.45] text-ink-quiet">
          {description}
        </div>
      ) : null}
      {children}
    </div>
  );
}
