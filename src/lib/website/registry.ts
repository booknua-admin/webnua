// =============================================================================
// Section type registry — every section type registers a Fields component
// (left-rail form), a Preview component (right-pane render), a defaultData()
// factory, and metadata about which fields are copy vs media (drives the
// per-field capability check in Session 4's editor).
//
// Registry storage is a const array exported from sections/index.ts. No
// mutable registry, no hot-reload duplication risk. Adding a new section
// type V2 is a new module under sections/ plus one entry in the array.
//
// Type-safety strategy: per-section data shapes are typed by each section
// module (e.g. HeroData). The registry array stores SectionTypeDefinition
// <unknown> uniformly; consumers that need typed access cast at the
// component-prop boundary. The defaultData() factory guarantees runtime
// shape correctness.
// =============================================================================

import type { ComponentType } from 'react';

import type { BrandObject, PageType, SectionType } from './types';

export type SectionFieldsProps<TData> = {
  data: TData;
  onChange: (next: TData) => void;
};

export type SectionPreviewProps<TData> = {
  data: TData;
  brand: BrandObject;
};

export type SectionCapabilityHints = {
  /** Field keys that are pure-copy. Need `editCopy` to mutate. */
  copyFields?: readonly string[];
  /** Field keys that bear media. Need `editMedia` to mutate. */
  mediaFields?: readonly string[];
};

export type SectionTypeDefinition<TData = unknown> = {
  type: SectionType;
  /** Eyebrow-style label rendered in section pickers, e.g. "// HERO". */
  label: string;
  /** Short description shown in the "Add section" menu. */
  description: string;
  /** Factory that returns a fresh, valid data shape for this section type. */
  defaultData: () => TData;
  Fields: ComponentType<SectionFieldsProps<TData>>;
  Preview: ComponentType<SectionPreviewProps<TData>>;
  capabilityHints?: SectionCapabilityHints;
  /** Page types this section is allowed on. Omit / empty = all pages. */
  allowedPageTypes?: readonly PageType[];
  /** False for section types whose Fields/Preview are still placeholders. */
  implemented: boolean;
};

/** Type-preserving helper for registering a section. */
export function defineSection<TData>(
  def: SectionTypeDefinition<TData>,
): SectionTypeDefinition<TData> {
  return def;
}
