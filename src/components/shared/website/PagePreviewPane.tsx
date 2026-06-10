'use client';

// =============================================================================
// PagePreviewPane — renders every section's Preview vertically stacked, the
// way the page will appear to a visitor.
//
// Rail-removal model (Phase 6): there is no left section list. Every section
// renders here — disabled ones dimmed with a "Hidden" badge so they stay
// re-enableable — and per-section management (move / duplicate / hide /
// delete) is a hover toolbar on each section. An "+ Add section" button sits
// at the foot. When the management callbacks are omitted (the wizard walk,
// the dev surface) the chrome is suppressed.
// =============================================================================

import { CapabilityGate } from '@/components/shared/CapabilityGate';
import { SectionFormSlotProvider } from '@/lib/website/sections/_shared/section-form-slot';
import type { BrandObject, Section } from '@/lib/website/types';
import { getSectionDefinition } from '@/lib/website/sections';

import { SectionHoverToolbar } from './SectionHoverToolbar';

/** Preview device — constrains the canvas width so the section container
 *  queries render the matching responsive layout. */
export type DevicePreview = 'desktop' | 'tablet' | 'mobile';

const DEVICE_WIDTH: Record<DevicePreview, string> = {
  desktop: 'max-w-[1100px]',
  tablet: 'max-w-[840px]',
  mobile: 'max-w-[420px]',
};

export type PagePreviewPaneProps = {
  sections: Section[];
  brand: BrandObject;
  /** Device preview width. Default desktop. */
  device?: DevicePreview;
  onSelectSection?: (sectionId: string) => void;
  selectedSectionId?: string | null;
  selectedElementId?: string | null;
  onSelectElement?: (id: string | null) => void;
  /** The client UUID a form test-submit creates a lead against. When set,
   *  forms in the preview show the "Test submit" affordance. */
  testClientId?: string | null;
  /** Surface kind for any test-submitted lead — propagated to
   *  `leads.source_kind`. Default 'website' (the editor is opened against a
   *  website page far more often than a funnel step). */
  testSurfaceKind?: 'website' | 'funnel';
  /** Funnel UUID for any test-submitted lead — propagated to
   *  `leads.source_funnel_id` so test leads attribute to the funnel under
   *  edit (FIX E). Omitted on website-page editing. */
  testFunnelId?: string | null;
  /** Section ids changed by a pending AI-edit proposal — these ring in rust
   *  with a "✦ AI" badge so the operator sees exactly what the proposal
   *  touched before applying (the AIEditBar owns Apply/Discard). */
  proposalHighlightIds?: Set<string> | null;
  // Section management — when provided, the hover toolbar + add button show.
  onToggleSectionEnabled?: (id: string, enabled: boolean) => void;
  onRemoveSection?: (id: string) => void;
  onMoveSection?: (id: string, direction: -1 | 1) => void;
  onDuplicateSection?: (id: string) => void;
  onRequestAddSection?: () => void;
};

export function PagePreviewPane({
  sections,
  brand,
  device = 'desktop',
  onSelectSection,
  selectedSectionId,
  selectedElementId,
  onSelectElement,
  testClientId,
  testSurfaceKind = 'website',
  testFunnelId,
  proposalHighlightIds,
  onToggleSectionEnabled,
  onRemoveSection,
  onMoveSection,
  onDuplicateSection,
  onRequestAddSection,
}: PagePreviewPaneProps) {
  const manageable =
    !!onToggleSectionEnabled &&
    !!onRemoveSection &&
    !!onMoveSection &&
    !!onDuplicateSection;

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-paper-2 py-6">
      <div
        className={`mx-auto flex ${DEVICE_WIDTH[device]} flex-col gap-4 px-4 transition-[max-width] duration-200`}
      >
        {sections.length === 0 ? (
          <div className="rounded-xl border border-dashed border-rule bg-paper px-7 py-9 text-center">
            <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-rust">
              {'// EMPTY PAGE'}
            </p>
            <p className="text-[15px] font-bold text-ink">No sections yet.</p>
            <p className="mt-1 text-[13px] leading-[1.5] text-ink-mid">
              Add a section to start building the page.
            </p>
          </div>
        ) : (
          sections.map((section, i) => {
            const def = getSectionDefinition(section.type);
            if (!def) return null;
            const Preview = def.Preview;
            const isSelected = selectedSectionId === section.id;
            const isProposalChanged = proposalHighlightIds?.has(section.id) ?? false;
            return (
              <div
                key={section.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectSection?.(section.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectSection?.(section.id);
                  }
                }}
                className={
                  'group relative block w-full overflow-hidden rounded-xl text-left transition-shadow ' +
                  (isSelected || isProposalChanged
                    ? 'ring-2 ring-rust ring-offset-2 ring-offset-paper-2'
                    : 'cursor-pointer hover:ring-2 hover:ring-rust/30 hover:ring-offset-2 hover:ring-offset-paper-2')
                }
              >
                <div className={section.enabled ? '' : 'opacity-45'}>
                  {/* The section's attached form (if any) renders WITHIN the
                      section — SectionShell reads this slot and places the
                      form in the band; the hero places it in its column. */}
                  <SectionFormSlotProvider
                    value={
                      section.form
                        ? {
                            form: section.form,
                            brand,
                            selectedElement: isSelected ? selectedElementId : undefined,
                            onSelectElement: isSelected ? onSelectElement : undefined,
                            testSubmitCtx: testClientId
                              ? {
                                  clientId: testClientId,
                                  surfaceKind: testSurfaceKind,
                                  funnelId:
                                    testSurfaceKind === 'funnel'
                                      ? testFunnelId ?? null
                                      : null,
                                  sourceLabel: `Form · ${def.label.replace(/^\/\/\s*/, '')}`,
                                }
                              : undefined,
                          }
                        : null
                    }
                  >
                    <Preview
                      data={section.data as never}
                      brand={brand}
                      selectedElement={isSelected ? selectedElementId : undefined}
                      onSelectElement={isSelected ? onSelectElement : undefined}
                    />
                  </SectionFormSlotProvider>
                </div>
                {!section.enabled ? (
                  <span className="absolute left-3 top-3 z-20 rounded bg-ink/90 px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-paper">
                    Hidden
                  </span>
                ) : null}
                {isProposalChanged ? (
                  <span className="absolute right-3 top-3 z-20 rounded bg-rust px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-paper">
                    ✦ AI edit
                  </span>
                ) : null}
                {manageable ? (
                  <SectionHoverToolbar
                    enabled={section.enabled}
                    canMoveUp={i > 0}
                    canMoveDown={i < sections.length - 1}
                    visible={isSelected}
                    onMoveUp={() => onMoveSection!(section.id, -1)}
                    onMoveDown={() => onMoveSection!(section.id, 1)}
                    onToggleEnabled={() =>
                      onToggleSectionEnabled!(section.id, !section.enabled)
                    }
                    onDuplicate={() => onDuplicateSection!(section.id)}
                    onRemove={() => onRemoveSection!(section.id)}
                  />
                ) : null}
              </div>
            );
          })
        )}

        {onRequestAddSection ? (
          <CapabilityGate capability="editSections" mode="disable">
            <button
              type="button"
              onClick={onRequestAddSection}
              className="rounded-xl border border-dashed border-rule bg-paper py-4 text-[13px] font-bold text-ink-mid transition-colors hover:border-rust hover:text-rust"
            >
              + Add section
            </button>
          </CapabilityGate>
        ) : null}
      </div>
    </div>
  );
}
