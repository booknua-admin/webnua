import type { Capability } from '@/lib/auth/capabilities';

// =============================================================================
// buildRequestChangeHref — the single source of truth for the URL a
// request-change affordance routes to.
//
// `<CapabilityGate mode="request">` (design doc §1.3 / §3.3 Lane C) surfaces
// a "request a change" affordance over any control a user lacks the cap for.
// Clicking it lands the user on the ticket submit form (/tickets/new) with
// the field context carried in query params so the form can prefill.
// Builder-field changes are always the `website` ticket category.
// =============================================================================

export type RequestChangeParams = {
  capability?: Capability;
  pageId?: string;
  sectionId?: string;
  fieldKey?: string;
  /** Human label of the section the field sits in, e.g. "Hero". */
  sectionLabel?: string;
  /** Human label of the field, e.g. "Headline". */
  fieldLabel?: string;
  /** The field's current value — so the operator sees what's being changed. */
  currentValue?: string;
};

/** Cap on the current-value carried in the URL — keeps the link sane. */
const CURRENT_VALUE_MAX = 280;

export function buildRequestChangeHref(params: RequestChangeParams = {}): string {
  const q = new URLSearchParams();
  q.set('from', 'request-change');
  q.set('category', 'website');
  if (params.capability) q.set('cap', params.capability);
  if (params.pageId) q.set('page', params.pageId);
  if (params.sectionId) q.set('section', params.sectionId);
  if (params.fieldKey) q.set('field', params.fieldKey);
  if (params.sectionLabel) q.set('sectionLabel', params.sectionLabel);
  if (params.fieldLabel) q.set('fieldLabel', params.fieldLabel);
  if (params.currentValue) {
    q.set('current', params.currentValue.slice(0, CURRENT_VALUE_MAX));
  }
  return `/tickets/new?${q.toString()}`;
}
