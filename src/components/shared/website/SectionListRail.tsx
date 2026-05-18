'use client';

// =============================================================================
// SectionListRail — the editor's left rail. Two modes (design doc §2.6):
//
//   { kind: 'page', title }
//     → "// SECTIONS" header + page title + count, multi-row list with
//       drag handles + enable toggles, "+ Add section" footer button.
//
//   { kind: 'singleton', label }
//     → "// WEBSITE-LEVEL · {LABEL}" header, single row with no
//       drag/toggle/add controls, explainer card at the bottom.
//
// "Add section" is gated on `editSections`. Drag handles and toggles are
// gated on `editLayout` (inside SectionRailRow). The rail itself is visible
// to every user (even view-only).
// =============================================================================

import { CapabilityGate } from '@/components/shared/CapabilityGate';
import { Button } from '@/components/ui/button';
import type { Section } from '@/lib/website/types';

import { SectionRailRow } from './SectionRailRow';

export type SectionListRailMode =
  | { kind: 'page'; title: string }
  | { kind: 'singleton'; label: string };

export type SectionListRailProps = {
  mode: SectionListRailMode;
  sections: Section[];
  selectedSectionId: string | null;
  onSelectSection: (id: string) => void;
  onToggleSectionEnabled: (id: string, enabled: boolean) => void;
  onRemoveSection?: (id: string) => void;
  onMoveSection?: (id: string, direction: -1 | 1) => void;
  onRequestAddSection?: () => void;
  /** Collapsed to a thin strip (when a section is being inspected). */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
};

export function SectionListRail({
  mode,
  sections,
  selectedSectionId,
  onSelectSection,
  onToggleSectionEnabled,
  onRemoveSection,
  onMoveSection,
  onRequestAddSection,
  collapsed = false,
  onToggleCollapsed,
}: SectionListRailProps) {
  const isSingleton = mode.kind === 'singleton';
  const enabledCount = sections.filter((s) => s.enabled).length;

  if (collapsed) {
    return (
      <aside
        data-slot="section-list-rail"
        data-rail-mode="collapsed"
        className="flex h-full flex-col items-center gap-4 border-r border-rule bg-paper py-4"
      >
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label="Expand sections"
          className="flex h-7 w-7 items-center justify-center rounded-md border border-rule bg-card text-[15px] font-bold text-ink-quiet transition-colors hover:border-rust hover:text-rust"
        >
          ›
        </button>
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-quiet [writing-mode:vertical-rl]">
          Sections · {sections.length}
        </p>
      </aside>
    );
  }

  return (
    <aside
      data-slot="section-list-rail"
      data-rail-mode={mode.kind}
      className="flex h-full min-h-0 flex-col border-r border-rule bg-paper"
    >
      <div className="border-b border-rule px-4 py-4">
        {isSingleton ? (
          <>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
              {`// WEBSITE-LEVEL · ${mode.label.toUpperCase()}`}
            </p>
            <p className="mt-1 truncate text-[15px] font-bold text-ink">
              {mode.label}
            </p>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet">
              Singleton · wraps every page
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
                {'// SECTIONS'}
              </p>
              {onToggleCollapsed ? (
                <button
                  type="button"
                  onClick={onToggleCollapsed}
                  aria-label="Collapse sections"
                  className="text-[15px] font-bold leading-none text-ink-quiet transition-colors hover:text-rust"
                >
                  ‹
                </button>
              ) : null}
            </div>
            <p className="mt-1 truncate text-[15px] font-bold text-ink">
              {mode.title}
            </p>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet">
              <strong className="text-ink">{enabledCount}</strong> of{' '}
              {sections.length} on
            </p>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        <div className="flex flex-col gap-2">
          {sections.map((section, i) => (
            <SectionRailRow
              key={section.id}
              section={section}
              index={i}
              selected={selectedSectionId === section.id}
              onSelect={() => onSelectSection(section.id)}
              onToggleEnabled={(enabled) =>
                onToggleSectionEnabled(section.id, enabled)
              }
              onRemove={
                !isSingleton && onRemoveSection
                  ? () => onRemoveSection(section.id)
                  : undefined
              }
              onMoveUp={() => onMoveSection?.(section.id, -1)}
              onMoveDown={() => onMoveSection?.(section.id, 1)}
              canMoveUp={!isSingleton && i > 0}
              canMoveDown={!isSingleton && i < sections.length - 1}
              singleton={isSingleton}
            />
          ))}
        </div>
      </div>

      <div className="border-t border-rule px-3 py-3">
        {isSingleton ? (
          <div className="rounded-lg border border-dashed border-rule bg-paper-2 px-3 py-3 text-[12px] leading-[1.5] text-ink-quiet">
            <p className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
              Singleton
            </p>
            Wraps every page on this website. Editing the fields above
            changes what every page renders. Field editing lands in
            Session 4.
          </div>
        ) : (
          <CapabilityGate capability="editSections" mode="disable">
            <Button
              variant="secondary"
              size="sm"
              onClick={onRequestAddSection}
              className="w-full"
            >
              + Add section
            </Button>
          </CapabilityGate>
        )}
      </div>
    </aside>
  );
}
