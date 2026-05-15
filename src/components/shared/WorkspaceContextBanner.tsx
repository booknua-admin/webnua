'use client';

// =============================================================================
// WorkspaceContextBanner — small pill that reinforces which workspace context
// the operator is in (agency birds-eye OR a specific client sub-account).
// Picker is the primary control; this banner lives on context-aware page
// headers so the operator always knows where they are even if the sidebar
// scrolls out of view.
// =============================================================================

import { useWorkspace } from '@/lib/workspace/workspace-stub';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type WorkspaceContextBannerProps = {
  /** Override the default agency-mode copy. */
  agencyLabel?: string;
  /** Hide the "Return to agency" button (e.g. when not relevant). */
  hideReturnButton?: boolean;
  className?: string;
};

export function WorkspaceContextBanner({
  agencyLabel = 'All clients · birds-eye',
  hideReturnButton = false,
  className,
}: WorkspaceContextBannerProps) {
  const { activeClient, hydrated, clearActiveClient } = useWorkspace();

  if (!hydrated) return null;

  if (!activeClient) {
    return (
      <span
        data-slot="workspace-context-banner"
        className={cn(
          'inline-flex items-center gap-2 rounded-pill border border-rule bg-paper-2 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet',
          className,
        )}
      >
        <span aria-hidden className="text-ink">◆</span>
        {agencyLabel}
      </span>
    );
  }

  return (
    <span
      data-slot="workspace-context-banner"
      className={cn(
        'inline-flex items-center gap-3 rounded-pill border border-rust/30 bg-rust-soft px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust',
        className,
      )}
    >
      <span aria-hidden>●</span>
      Sub-account · {activeClient.name}
      {hideReturnButton ? null : (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearActiveClient}
          className="-my-1 h-auto px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust hover:bg-rust/10"
        >
          ← Back to agency
        </Button>
      )}
    </span>
  );
}
