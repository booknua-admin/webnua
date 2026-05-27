// =============================================================================
// Anchor library — typed worked-example briefs + home pages used as the
// prompt's worked-example slot (replaces the single hardcoded Voltline
// example in generation-prompt.ts). One anchor per buying motivation.
//
// SHAPE DISCIPLINE:
//   - Each anchor's page sections use real `Section` envelopes (id, type,
//     enabled, data, optional form/popup).
//   - Per-section `data` is typed as `Partial<XxxData>` against the real
//     section module's data type — wrong field names or wrong enum values
//     are TypeScript errors. Layout fields may be omitted (the model is
//     told not to specify them unless the brief justifies a variation),
//     so partial typing is correct and intended.
//   - Voice tone is integers 1–5 per `VoiceTone` (NOT 0–1 floats).
//
// Selection logic (when wired) will read `meta.buyingMotivation` +
// `meta.urgencyMode` + the brief's industry/voice signals to pick the
// nearest anchor. `meta` is internal — strip it before composing the
// prompt; the model sees only `brief` + `page`.
// =============================================================================

import type { Section, VoiceTone } from '../types';

export type BuyingMotivation =
  | 'speed'
  | 'craft'
  | 'proximity'
  | 'transformation'
  | 'simplicity';

export type UrgencyMode = 'emergency' | 'scheduled' | 'project';

export type AnchorMeta = {
  anchorId: string;
  buyingMotivation: BuyingMotivation;
  industry: string;
  urgencyMode: UrgencyMode;
  /** Internal commentary on the visual + voice register. Not for the model. */
  voiceVisualNote: string;
  /** Internal commentary on why the page structure converts this customer. */
  whyThisWinsThisCustomer: string;
};

export type AnchorOffer = {
  headline: string;
  promise: string;
  riskReversal: string;
  ctaLabel: string;
};

export type AnchorTestimonial = {
  author: string;
  text: string;
};

export type AnchorBrief = {
  businessName: string;
  industry: string;
  urgencyMode: UrgencyMode;
  serviceArea: string;
  services: string[];
  targetCustomer: string;
  usp: string;
  offer: AnchorOffer;
  /** Integers 1–5 — matches VoiceTone in `../types`. */
  voiceTone: VoiceTone;
  brandColors: { primary: string; ink: string };
  testimonials: AnchorTestimonial[];
};

export type AnchorPage = {
  id: 'home';
  slug: 'home';
  title: string;
  type: 'home';
  seo: { title: string; description: string };
  sections: Section[];
};

export type Anchor = {
  meta: AnchorMeta;
  brief: AnchorBrief;
  page: AnchorPage;
};
