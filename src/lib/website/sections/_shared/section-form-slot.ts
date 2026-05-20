'use client';

// =============================================================================
// SectionFormSlot — the context that lets a section render its attached form
// INSIDE its own layout (within the section background / band), rather than
// the form being a separate block stacked underneath.
//
// PagePreviewPane provides this per section (the section's `section.form`,
// plus the element-inspector + test-submit wiring). `SectionShell` consumes
// it and renders the form within the section band; a section with a bespoke
// form placement (the hero — a dedicated column) reads the slot directly and
// tells its SectionShell not to render it (`formSlot="self"`).
// =============================================================================

import { createContext, useContext } from 'react';

import type { FormConfig, FormTestSubmitContext } from '@/lib/website/form-config';
import type { BrandObject } from '@/lib/website/types';

/** Public-site submit wiring — present only when a form renders on a
 *  published page/funnel (not the editor). Drives FormBlock's real submit. */
export type PublicFormSubmit = {
  /** The client UUID the lead is created against. */
  clientId: string;
  /** Categorical surface attribution — written to `leads.source_kind` and
   *  surfaced on the inbox row's Source column. `'meta'` is reserved for the
   *  later Meta lead-ad integration. */
  surfaceKind: 'website' | 'funnel';
  /** Funnel-only — the funnel UUID the form is being served from. Written
   *  to `leads.source_funnel_id` so the funnel-detail "booked from this
   *  funnel" count can attribute. Omitted for website submissions. */
  funnelId?: string | null;
  /** Human label of the form's origin, e.g. "Form · hero". */
  sourceLabel: string;
  /** Funnel-only — where an `afterSubmit: nextStep` form advances to. */
  nextStepHref?: string | null;
};

export type SectionFormSlot = {
  form: FormConfig;
  brand: BrandObject;
  /** Element-inspector wiring — present only when the section is selected. */
  selectedElement?: string | null;
  onSelectElement?: (id: string) => void;
  /** When set, a "Test submit" affordance creates a real lead. */
  testSubmitCtx?: FormTestSubmitContext;
  /** When set, the form submits for real against the public endpoint. */
  publicSubmit?: PublicFormSubmit;
};

const SectionFormSlotContext = createContext<SectionFormSlot | null>(null);

export const SectionFormSlotProvider = SectionFormSlotContext.Provider;

/** The form attached to the section currently being rendered, or null. */
export function useSectionFormSlot(): SectionFormSlot | null {
  return useContext(SectionFormSlotContext);
}
