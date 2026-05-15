'use client';

// =============================================================================
// SectionListRail — the editor's left rail. Header (page name + section
// count) + ordered list of sections + "+ Add section" button.
//
// "Add section" is gated on `editSections`. The rail itself is visible to
// every user (even view-only).
// =============================================================================

import { CapabilityGate } from '@/components/shared/CapabilityGate';
import { Button } from '@/components/ui/button';
import type { Section } from '@/lib/website/types';

import { SectionRailRow } from './SectionRailRow';

export type SectionListRailProps = {
  pageTitle: string;
  sections: Section[];
  selectedSectionId: string | null;
  onSelectSection: (id: string) => void;
  onToggleSectionEnabled: (id: string, enabled: boolean) => void;
  onRequestAddSection?: () => void;
};

export function SectionListRail({
  pageTitle,
  sections,
  selectedSectionId,
  onSelectSection,
  onToggleSectionEnabled,
  onRequestAddSection,
}: SectionListRailProps) {
  const enabledCount = sections.filter((s) => s.enabled).length;

  return (
    <aside
      data-slot="section-list-rail"
      className="flex h-full flex-col border-r border-rule bg-paper"
    >
      <div className="border-b border-rule px-4 py-4">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
          {'// SECTIONS'}
        </p>
        <p className="mt-1 truncate text-[15px] font-bold text-ink">
          {pageTitle}
        </p>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet">
          <strong className="text-ink">{enabledCount}</strong> of{' '}
          {sections.length} on
        </p>
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
            />
          ))}
        </div>
      </div>

      <div className="border-t border-rule px-3 py-3">
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
      </div>
    </aside>
  );
}
