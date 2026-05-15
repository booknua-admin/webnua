'use client';

import type { ContainerKind, SectionType } from '../types';
import { defineSection, type SectionPreviewProps, type SectionTypeDefinition } from '../registry';

// =============================================================================
// Placeholder section definitions — section types whose Fields/Preview
// aren't yet implemented (real Fields land in Session 4). Each placeholder
// renders a dashed-border card explaining the section's purpose so the
// editor can iterate through every registered type without crashing.
//
// To "implement" a placeholder later:
//   1. Move into its own file under sections/{type}.tsx.
//   2. Define real defaultData, Fields, Preview.
//   3. Update sections/index.ts to import from the new file.
//   4. Delete the entry here.
//
// `header` and `footer` are placeholders here too, but live in their own
// files (sections/header.tsx, sections/footer.tsx) so the websiteHeader /
// websiteFooter container constraint is visible at first sight.
// =============================================================================

type PlaceholderMeta = {
  type: SectionType;
  label: string;
  description: string;
  allowedContainers: readonly ContainerKind[];
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

function makePlaceholderSection(
  meta: PlaceholderMeta,
): SectionTypeDefinition<Record<string, unknown>> {
  return defineSection<Record<string, unknown>>({
    type: meta.type,
    label: meta.label,
    description: meta.description,
    defaultData: () => ({}),
    Fields: PlaceholderFields,
    Preview: makePlaceholderPreview(meta),
    allowedContainers: meta.allowedContainers,
    implemented: false,
  });
}

export const trustSection = makePlaceholderSection({
  type: 'trust',
  label: '// TRUST',
  description: 'Row of trust signals — GBP rating, years in business, licence numbers, badges.',
  allowedContainers: ['page', 'funnelStep'],
});

export const reviewsSection = makePlaceholderSection({
  type: 'reviews',
  label: '// REVIEWS',
  description: 'Auto-pulled Google reviews carousel — 4★+ filtered, name + body + age.',
  allowedContainers: ['page', 'funnelStep'],
});

export const faqSection = makePlaceholderSection({
  type: 'faq',
  label: '// FAQ',
  description: 'Common-questions accordion — question + answer pairs.',
  allowedContainers: ['page', 'funnelStep'],
});

export const ctaSection = makePlaceholderSection({
  type: 'cta',
  label: '// CTA',
  description: 'End-of-page final-pitch block — short headline + button.',
  allowedContainers: ['page', 'funnelStep'],
});

export const schedulePickerSection = makePlaceholderSection({
  type: 'schedulePicker',
  label: '// SCHEDULE PICKER',
  description: 'Calendar-integrated booking picker. Funnel schedule steps only.',
  allowedContainers: ['funnelStep'],
});

export const thanksConfirmationSection = makePlaceholderSection({
  type: 'thanksConfirmation',
  label: '// THANKS',
  description: 'Confirmation block with referral CTA. Funnel thanks steps only.',
  allowedContainers: ['funnelStep'],
});

// -- Header and footer — website-level SINGLETONS --------------------------
//
// These implement the section interface (so the editor surface treats them
// the same way) but are NOT stackable. allowedContainers limits them to
// the website-level slots `Website.header` / `Website.footer`. Don't add
// them to a Page.sections[] — the registry constraint refuses, and the
// runtime would render them twice (once from the website chrome wrap, once
// inline).

export const headerSection = makePlaceholderSection({
  type: 'header',
  label: '// HEADER',
  description: 'Site header — logo + nav links + optional global CTA. Wraps every page.',
  allowedContainers: ['websiteHeader'],
});

export const footerSection = makePlaceholderSection({
  type: 'footer',
  label: '// FOOTER',
  description: 'Site footer — links + contact info + socials + legal. Wraps every page.',
  allowedContainers: ['websiteFooter'],
});
