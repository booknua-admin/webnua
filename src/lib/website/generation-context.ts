// =============================================================================
// generation-context — the deliverable of the form-to-page Q&A flow.
//
// Shape is identical regardless of flavour (new-page-on-existing-website vs
// first-page-of-website via onboarding wizard, design doc §3). Session 7's
// wizard refactor emits the same shape.
//
// `specifics` and `avoid` are stored verbatim (paste-friendly textareas, no
// length cap). The stub generator displays them in the generation card but
// does not consume them — see generation-stub.ts. Real backend wires them
// into the prompt construction (see generation-prompt.ts).
// =============================================================================

import type { BrandObject, PageType, SectionType } from './types';

export type PrimaryIntent =
  | { kind: 'book' }
  | { kind: 'call' }
  | { kind: 'quote' }
  | { kind: 'signup' }
  | { kind: 'read' }
  | { kind: 'other'; text: string };

export type Audience =
  | 'cold-ad'
  | 'existing'
  | 'referral'
  | 'search'
  | 'mixed';

/** Snapshot of a single existing page on the website. Helps the model stay
 *  tonally consistent with what's already published. ≤6 pages worth sent
 *  through the prompt — see generation-prompt.ts. */
export type ExistingPageSnapshot = {
  pageTitle: string;
  h1: string | null;
  primaryCta: string | null;
  sectionTypes: SectionType[];
};

export type GenerationContext = {
  flavour: 'new-page' | 'first-page';
  pageType: PageType;
  primaryIntent: PrimaryIntent;
  audience: Audience;
  specifics: string | null;
  avoid: string | null;
  brand: BrandObject;
  existingPages: ExistingPageSnapshot[];
};

// -- Labels for the chip rows / review surface ------------------------------

export const PAGE_TYPE_CHIPS: { id: PageType; label: string }[] = [
  { id: 'services', label: 'Service page' },
  { id: 'about', label: 'About page' },
  { id: 'contact', label: 'Contact page' },
  { id: 'generic', label: 'Landing page' },
];

export const PRIMARY_INTENT_CHIPS: {
  id: PrimaryIntent['kind'];
  label: string;
}[] = [
  { id: 'book', label: 'Book a job' },
  { id: 'call', label: 'Call now' },
  { id: 'quote', label: 'Get a quote' },
  { id: 'signup', label: 'Sign up' },
  { id: 'read', label: 'Read & inform' },
  { id: 'other', label: 'Other' },
];

export const AUDIENCE_CHIPS: { id: Audience; label: string }[] = [
  { id: 'cold-ad', label: 'Cold ad traffic' },
  { id: 'existing', label: 'Existing customers' },
  { id: 'referral', label: 'Word-of-mouth referrals' },
  { id: 'search', label: 'Search visitors' },
  { id: 'mixed', label: 'Mixed' },
];

export function describeIntent(intent: PrimaryIntent): string {
  switch (intent.kind) {
    case 'book':
      return 'Book a job';
    case 'call':
      return 'Call now';
    case 'quote':
      return 'Get a quote';
    case 'signup':
      return 'Sign up';
    case 'read':
      return 'Read & inform';
    case 'other':
      return `Other — ${intent.text}`;
  }
}

export function describeAudience(audience: Audience): string {
  return AUDIENCE_CHIPS.find((c) => c.id === audience)?.label ?? audience;
}

export function describePageType(type: PageType): string {
  return PAGE_TYPE_CHIPS.find((c) => c.id === type)?.label ?? type;
}
