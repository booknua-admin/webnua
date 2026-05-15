'use client';

// =============================================================================
// EditorToolbar — top bar of the section editor. Three slots:
//
//   Left  → back link + workspace context indicator + page tabs
//   Mid   → autosave indicator (Session 5 wires real autosave; visual stub here)
//   Right → preview-live link + Publish / Submit for review (capability-gated)
//
// The Publish path follows the design doc §3.3 three-lane model:
//   - user has `publish`            → "Publish →"
//   - user has any edit cap, no `publish` → "Submit for review →"
//   - view-only                     → button hidden entirely
// =============================================================================

import Link from 'next/link';

import { CapabilityGate } from '@/components/shared/CapabilityGate';
import { Button } from '@/components/ui/button';
import { useCan, useCanAny } from '@/lib/auth/user-stub';
import { cn } from '@/lib/utils';
import type { Page, Website } from '@/lib/website/types';

export type EditorToolbarProps = {
  website: Website;
  pages: Page[];
  activePageId: string;
};

export function EditorToolbar({ website, pages, activePageId }: EditorToolbarProps) {
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
          href="/website"
          className="flex shrink-0 items-center font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet hover:text-ink"
        >
          ← Back
        </Link>
        <span className="text-rule">·</span>
        <div className="flex min-w-0 items-center gap-1">
          {pages.map((page) => {
            const active = page.id === activePageId;
            return (
              <Link
                key={page.id}
                href={`/website/${page.id}`}
                className={cn(
                  'rounded-pill px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition-colors',
                  active
                    ? 'bg-ink text-paper'
                    : 'text-ink-quiet hover:bg-paper-2 hover:text-ink',
                )}
              >
                {page.type === 'landing'
                  ? 'Landing'
                  : page.type === 'schedule'
                    ? 'Schedule'
                    : page.type === 'thanks'
                      ? 'Thanks'
                      : page.slug}
              </Link>
            );
          })}
        </div>
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
            requestContext={{ pageId: activePageId }}
          >
            <Button size="sm">Submit for review →</Button>
          </CapabilityGate>
        ) : null}
      </div>
    </div>
  );
}
