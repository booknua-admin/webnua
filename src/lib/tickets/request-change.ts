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
};

export function buildRequestChangeHref(params: RequestChangeParams = {}): string {
  const q = new URLSearchParams();
  q.set('from', 'request-change');
  q.set('category', 'website');
  if (params.capability) q.set('cap', params.capability);
  if (params.pageId) q.set('page', params.pageId);
  if (params.sectionId) q.set('section', params.sectionId);
  if (params.fieldKey) q.set('field', params.fieldKey);
  return `/tickets/new?${q.toString()}`;
}
