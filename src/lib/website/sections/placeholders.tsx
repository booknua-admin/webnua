'use client';

import type { SectionType } from '../types';
import { defineSection, type SectionPreviewProps, type SectionTypeDefinition } from '../registry';

// =============================================================================
// Placeholder section definitions for the section types that aren't yet
// implemented (Fields/Preview built out in Session 4). Each placeholder
// renders a dashed-border card explaining the section's purpose, so the
// editor surface (Session 3+) can still iterate through every registered
// type without crashing on a missing component.
//
// To "implement" a placeholder later:
//   1. Move the section type into its own file under sections/{type}.tsx.
//   2. Define real defaultData, Fields, Preview.
//   3. Update sections/index.ts to import from the new file.
//   4. Delete the entry here.
// =============================================================================

type PlaceholderMeta = {
  type: SectionType;
  label: string;
  description: string;
};

function PlaceholderFields() {
  return (
    <div className="rounded-lg border border-dashed border-rule bg-paper px-4 py-6 text-center text-[12px] text-ink-quiet">
      <p className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink">
        Not yet implemented
      </p>
      <p>
        Fields for this section type are stubbed. Implementation lands when
        the editor surface arrives in Session 4.
      </p>
    </div>
  );
}

function makePlaceholderPreview(meta: PlaceholderMeta) {
  function Preview({ brand }: SectionPreviewProps<Record<string, unknown>>) {
    return (
      <section
        data-section-type={meta.type}
        data-placeholder
        className="rounded-xl border border-dashed border-rule bg-paper px-7 py-7"
      >
        <p
          className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em]"
          style={{ color: brand.accentColor }}
        >
          {meta.label}
        </p>
        <p className="mb-1 text-[15px] font-bold text-ink">
          {meta.type} section
        </p>
        <p className="max-w-[460px] text-[12.5px] leading-[1.5] text-ink-quiet">
          {meta.description} Preview rendering arrives with the editor in
          Session 4.
        </p>
      </section>
    );
  }
  Preview.displayName = `Placeholder${meta.type[0].toUpperCase()}${meta.type.slice(1)}Preview`;
  return Preview;
}

function makePlaceholderSection(meta: PlaceholderMeta): SectionTypeDefinition<Record<string, unknown>> {
  return defineSection<Record<string, unknown>>({
    type: meta.type,
    label: meta.label,
    description: meta.description,
    defaultData: () => ({}),
    Fields: PlaceholderFields,
    Preview: makePlaceholderPreview(meta),
    implemented: false,
  });
}

export const trustSection = makePlaceholderSection({
  type: 'trust',
  label: '// TRUST',
  description: 'Row of trust signals — GBP rating, years in business, licence numbers, badges.',
});

export const reviewsSection = makePlaceholderSection({
  type: 'reviews',
  label: '// REVIEWS',
  description: 'Auto-pulled Google reviews carousel — 4★+ filtered, name + body + age.',
});

export const faqSection = makePlaceholderSection({
  type: 'faq',
  label: '// FAQ',
  description: 'Common-questions accordion — question + answer pairs.',
});

export const ctaSection = makePlaceholderSection({
  type: 'cta',
  label: '// CTA',
  description: 'End-of-page final-pitch block — short headline + button.',
});

export const schedulePickerSection = makePlaceholderSection({
  type: 'schedulePicker',
  label: '// SCHEDULE PICKER',
  description: 'Calendar-integrated booking picker. Schedule pages only.',
});

export const thanksConfirmationSection = makePlaceholderSection({
  type: 'thanksConfirmation',
  label: '// THANKS',
  description: 'Confirmation block with referral CTA. Thanks pages only.',
});
