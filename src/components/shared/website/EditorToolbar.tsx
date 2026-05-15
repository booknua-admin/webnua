'use client';

// =============================================================================
// EditorToolbar — top bar of the section editor. Three slots:
//
//   Left  → back link + tabs (page-tabs mode) OR breadcrumb (singleton mode)
//   Mid   → autosave indicator (Session 5 wires real autosave; visual stub)
//   Right → preview-live link + Publish / Submit for review (capability-gated)
//
// The toolbar takes a discriminated `mode`:
//   { kind: 'tabs', ...}        → renders one pill per tab. Used for page
//                                  editing (one tab per Page in the website's
//                                  pageOrder). Could later be used for funnel
//                                  step tabs (Session 7).
//   { kind: 'breadcrumb', ...}  → renders a static "← Back to {target} ·
//                                  {label}" line. Used for singleton editors
//                                  (/website/header, /website/footer) where
//                                  there's nothing to switch between.
//
// The publish path follows design doc §3.3:
//   - user has `publish`            → "Publish →"
//   - user has any edit cap, no `publish` → "Submit for review →"
//   - view-only                     → button hidden entirely
// =============================================================================

import Link from 'next/link';

import { CapabilityGate } from '@/components/shared/CapabilityGate';
import { Button } from '@/components/ui/button';
import { useCan, useCanAny } from '@/lib/auth/user-stub';
import { cn } from '@/lib/utils';
import type { Website } from '@/lib/website/types';

export type EditorToolbarTab = {
  id: string;
  label: string;
  href: string;
};

export type EditorToolbarMode =
  | {
      kind: 'tabs';
      tabs: EditorToolbarTab[];
      activeTabId: string;
    }
  | {
      kind: 'breadcrumb';
      label: string;
      /** Where the breadcrumb "back" link points. Defaults to /website. */
      backHref?: string;
    };

export type EditorToolbarProps = {
  website: Website;
  mode: EditorToolbarMode;
  /** Forwarded to the publish action's request-change context. */
  activePageId?: string;
};

export function EditorToolbar({ website, mode, activePageId }: EditorToolbarProps) {
  const canPublish = useCan('publish');
  const canEditAnything = useCanAny(
    'editCopy',
    'editMedia',
    'editSEO',
    'editLayout',
    'editSections',
  );

  return (
    <div
      data-slot="editor-toolbar"
      className="flex items-center justify-between gap-4 border-b border-rule bg-paper px-5 py-2.5"
    >
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href={mode.kind === 'breadcrumb' ? (mode.backHref ?? '/website') : '/website'}
          className="flex shrink-0 items-center font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet hover:text-ink"
        >
          ← Back
        </Link>
        <span className="text-rule">·</span>
        {mode.kind === 'tabs' ? (
          <div className="flex min-w-0 items-center gap-1">
            {mode.tabs.map((tab) => {
              const active = tab.id === mode.activeTabId;
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className={cn(
                    'rounded-pill px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition-colors',
                    active
                      ? 'bg-ink text-paper'
                      : 'text-ink-quiet hover:bg-paper-2 hover:text-ink',
                  )}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        ) : (
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink">
            {mode.label}
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <span className="hidden font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet md:inline-flex md:items-center md:gap-1.5">
          <span aria-hidden className="size-1.5 rounded-full bg-good" />
          Autosaved · stub
        </span>
        <a
          href={`https://${website.domain.primary}`}
          target="_blank"
          rel="noreferrer"
          className="hidden font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet hover:text-ink md:inline"
        >
          View live ↗
        </a>
        {canPublish ? (
          <Button size="sm">Publish →</Button>
        ) : canEditAnything ? (
          <CapabilityGate
            capability="publish"
            mode="request"
            requestContext={activePageId ? { pageId: activePageId } : undefined}
          >
            <Button size="sm">Submit for review →</Button>
          </CapabilityGate>
        ) : null}
      </div>
    </div>
  );
}
