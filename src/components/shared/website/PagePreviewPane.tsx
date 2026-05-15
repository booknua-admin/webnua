'use client';

// =============================================================================
// PagePreviewPane — renders every enabled section's Preview vertically
// stacked, the way the page will appear to a visitor. Driven by the
// section registry (each section type provides its own Preview).
//
// Disabled sections aren't rendered. Empty page renders an empty-state
// dashed-border placeholder.
// =============================================================================

import type { BrandObject, Section } from '@/lib/website/types';
import { getSectionDefinition } from '@/lib/website/sections';

export type PagePreviewPaneProps = {
  sections: Section[];
  brand: BrandObject;
  /** Optional click handler for section selection (Session 4 wires editing). */
  onSelectSection?: (sectionId: string) => void;
  selectedSectionId?: string | null;
};

export function PagePreviewPane({
  sections,
  brand,
  onSelectSection,
  selectedSectionId,
}: PagePreviewPaneProps) {
  const enabled = sections.filter((s) => s.enabled);

  if (enabled.length === 0) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center bg-paper-2 px-10 py-10">
        <div className="max-w-[440px] rounded-xl border border-dashed border-rule bg-paper px-7 py-9 text-center">
          <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-rust">
            {'// EMPTY PAGE'}
          </p>
          <p className="text-[15px] font-bold text-ink">
            No enabled sections.
          </p>
          <p className="mt-1 text-[13px] leading-[1.5] text-ink-mid">
            Toggle a section on in the rail, or add a new section from the
            picker.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-paper-2 px-6 py-6 md:px-10">
      <div className="mx-auto flex max-w-[760px] flex-col gap-4">
        {enabled.map((section) => {
          const def = getSectionDefinition(section.type);
          if (!def) return null;
          const Preview = def.Preview;
          const isSelected = selectedSectionId === section.id;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onSelectSection?.(section.id)}
              className={
                'group block w-full rounded-xl text-left transition-shadow ' +
                (isSelected
                  ? 'ring-2 ring-rust ring-offset-2 ring-offset-paper-2'
                  : 'hover:ring-2 hover:ring-rust/30 hover:ring-offset-2 hover:ring-offset-paper-2')
              }
            >
              <Preview data={section.data as never} brand={brand} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
