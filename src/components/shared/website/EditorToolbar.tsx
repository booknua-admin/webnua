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
import type { AutosaveStatus } from '@/lib/website/use-autosave';

import { AutosaveIndicator } from './AutosaveIndicator';
import type { DevicePreview } from './PagePreviewPane';

const DEVICE_GLYPH: Record<DevicePreview, string> = {
  desktop: '▭',
  tablet: '▢',
  mobile: '▯',
};
const DEVICE_ORDER: readonly DevicePreview[] = ['desktop', 'tablet', 'mobile'];

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
      /** Where the "← Back" link points. Defaults to /website. Funnel
       *  editors pass `/funnels/[id]` (Session 7). */
      backHref?: string;
    }
  | {
      kind: 'breadcrumb';
      label: string;
      /** Where the breadcrumb "back" link points. Defaults to /website. */
      backHref?: string;
    };

export type EditorToolbarAutosave = {
  status: AutosaveStatus;
  lastSavedAt: number | null;
  onRetry: () => void;
};

export type EditorToolbarProps = {
  /** Domain to deep-link the "View live ↗" affordance to. */
  domain: string;
  mode: EditorToolbarMode;
  /** Forwarded to the publish action's request-change context. */
  activePageId?: string;
  /** Live autosave state. Hidden when omitted (used by static demos). */
  autosave?: EditorToolbarAutosave;
  /** Hide both publish actions — used when the editor is locked for the
   *  current user (Lane B submitter waiting on review) or when the surface
   *  doesn't have publish wired yet (funnel-step editor, Session 7). */
  publishDisabled?: boolean;
  /** Session 8 — when set, the lane buttons collapse into a single
   *  "Review →" link routing here. The review surface owns the actual
   *  publish / submit calls so preflight is a mandatory gate (design §7).
   *  When omitted, falls back to the direct `onPublish` / `onSubmitForReview`
   *  buttons (funnel-step editor still uses the direct path). */
  reviewHref?: string;
  /** Fired on the rust "Publish →" button (Lane A). Ignored when
   *  `reviewHref` is set. */
  onPublish?: () => void;
  /** Fired on the ghost "Submit for review →" button (Lane B). Ignored
   *  when `reviewHref` is set. */
  onSubmitForReview?: () => void;
  /** Render a chevron menu next to Publish with the force-publish item.
   *  Wired in by chunk F; omit to hide the menu. */
  publishMenu?: React.ReactNode;
  /** Site-level style control (the brand font menu). Rendered in the right
   *  cluster; omit to hide. */
  siteStyles?: React.ReactNode;
  /** Site-wide SEO control (the SEO panel trigger). Rendered in the right
   *  cluster; omit to hide. */
  seo?: React.ReactNode;
  /** Header-menu control (the nav panel trigger). Rendered in the right
   *  cluster; omit to hide — set only in singleton header mode. */
  nav?: React.ReactNode;
  /** Undo / redo controls. Omit to hide. */
  history?: {
    onUndo: () => void;
    onRedo: () => void;
    canUndo: boolean;
    canRedo: boolean;
  };
  /** Device-preview toggle. Omit to hide. */
  device?: {
    value: DevicePreview;
    onChange: (device: DevicePreview) => void;
  };
};

export function EditorToolbar({
  domain,
  mode,
  activePageId,
  autosave,
  publishDisabled = false,
  reviewHref,
  onPublish,
  onSubmitForReview,
  publishMenu,
  siteStyles,
  seo,
  nav,
  history,
  device,
}: EditorToolbarProps) {
  const canPublish = useCan('publish');
  const canEditAnything = useCanAny(
    'editCopy',
    'editMedia',
    'editSEO',
    'editLayout',
    'editSections',
  );

  const backHref = mode.backHref ?? '/website';

  return (
    <div
      data-slot="editor-toolbar"
      className="flex items-center justify-between gap-4 border-b border-rule bg-paper px-5 py-2.5"
    >
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href={backHref}
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
        {history ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={history.onUndo}
              disabled={!history.canUndo}
              aria-label="Undo"
              title="Undo"
              className="flex h-7 w-7 items-center justify-center rounded-md border border-rule bg-card text-[16px] leading-none text-ink-mid transition-colors hover:border-rust hover:text-rust disabled:opacity-35 disabled:hover:border-rule disabled:hover:text-ink-mid"
            >
              ↶
            </button>
            <button
              type="button"
              onClick={history.onRedo}
              disabled={!history.canRedo}
              aria-label="Redo"
              title="Redo"
              className="flex h-7 w-7 items-center justify-center rounded-md border border-rule bg-card text-[16px] leading-none text-ink-mid transition-colors hover:border-rust hover:text-rust disabled:opacity-35 disabled:hover:border-rule disabled:hover:text-ink-mid"
            >
              ↷
            </button>
          </div>
        ) : null}
        {autosave ? (
          <AutosaveIndicator
            status={autosave.status}
            lastSavedAt={autosave.lastSavedAt}
            onRetry={autosave.onRetry}
          />
        ) : null}
        {device ? (
          <div className="flex items-center gap-0.5 rounded-md border border-rule bg-card p-0.5">
            {DEVICE_ORDER.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => device.onChange(d)}
                aria-label={`${d} preview`}
                title={`${d} preview`}
                className={cn(
                  'flex h-6 w-7 items-center justify-center rounded text-[14px] leading-none transition-colors',
                  device.value === d
                    ? 'bg-ink text-paper'
                    : 'text-ink-quiet hover:text-ink',
                )}
              >
                {DEVICE_GLYPH[d]}
              </button>
            ))}
          </div>
        ) : null}
        {nav}
        {seo}
        {siteStyles}
        <a
          href={`https://${domain}`}
          target="_blank"
          rel="noreferrer"
          className="hidden font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet hover:text-ink md:inline"
        >
          View live ↗
        </a>
        {publishDisabled ? null : reviewHref ? (
          // Session 8 — review surface is the publish gate. Both lanes
          // route here; the surface renders the lane-correct action.
          (canPublish || canEditAnything) ? (
            <span className="inline-flex items-center gap-1.5">
              <Button size="sm" asChild>
                <Link href={reviewHref}>Review &amp; publish →</Link>
              </Button>
              {canPublish ? publishMenu : null}
            </span>
          ) : null
        ) : canPublish ? (
          <span className="inline-flex items-center gap-1.5">
            <Button size="sm" onClick={onPublish}>
              Publish →
            </Button>
            {publishMenu}
          </span>
        ) : canEditAnything ? (
          <CapabilityGate
            capability="publish"
            mode="request"
            requestContext={activePageId ? { pageId: activePageId } : undefined}
          >
            <Button size="sm" onClick={onSubmitForReview}>
              Submit for review →
            </Button>
          </CapabilityGate>
        ) : null}
      </div>
    </div>
  );
}
