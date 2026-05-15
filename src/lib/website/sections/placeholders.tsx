'use client';

// =============================================================================
// Placeholder section definitions — empty in Session 4.
//
// All eight previously-stubbed types (trust, reviews, faq, cta,
// schedulePicker, thanksConfirmation, header, footer) graduated into their
// own implementation files in Session 4. This module remains as the
// canonical spot for any FUTURE placeholder types — e.g. when V2 adds a
// new section type, register it here first with placeholder Fields/Preview
// before promoting to its own module.
// =============================================================================

import type { ContainerKind, SectionType } from '../types';
import {
  defineSection,
  type SectionPreviewProps,
  type SectionTypeDefinition,
} from '../registry';

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
      <p>Fields for this section type are stubbed.</p>
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
          {meta.description}
        </p>
      </section>
    );
  }
  Preview.displayName = `Placeholder${meta.type[0].toUpperCase()}${meta.type.slice(1)}Preview`;
  return Preview;
}

/** Helper to register a new placeholder. Used by future V2 section types
 *  before promotion to their own module. */
export function makePlaceholderSection(
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
