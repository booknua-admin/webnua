// =============================================================================
// Industry → design-bundle default mapping (Bundle C2b-1).
//
// Used at brand-create time to assign a sensible bundle when the operator /
// customer hasn't picked one explicitly. The customer can override later
// via /settings/brand (V1.1 UI — V1 ships data-model only).
//
// Assignment rules (from the C2 audit + locked decisions):
//
//   sharp_direct       electrician, plumber, locksmith, hvac, roofer
//                      → emergency-callout trades that benefit from a
//                        no-nonsense, technical feel.
//   warm_established   cleaner, painter, landscaper
//                      → scheduled / repeat-customer trades where warmth
//                        and trust read louder than urgency.
//   clean_premium      carpenter
//                      → project-grade craft trades where restraint sells.
//   bold_direct        handyman, generic
//                      → versatile direct-response default. Also the global
//                        fallback for unknown industries.
//
// Adding a new industry:
//   1. Add the key to `industry-templates.ts` (template registry)
//   2. Add an entry below — without it the industry falls through to
//      'bold_direct'
// =============================================================================

import type { DesignBundleId } from './design-bundles';

/** Hardcoded industry → bundle map. Keys mirror `industry-templates.ts`. */
export const INDUSTRY_BUNDLE_DEFAULTS: Record<string, DesignBundleId> = {
  electrician: 'sharp_direct',
  plumber: 'sharp_direct',
  locksmith: 'sharp_direct',
  hvac: 'sharp_direct',
  roofer: 'sharp_direct',
  cleaner: 'warm_established',
  painter: 'warm_established',
  landscaper: 'warm_established',
  carpenter: 'clean_premium',
  handyman: 'bold_direct',
  generic: 'bold_direct',
};

/** The global fallback when an industry key has no explicit assignment.
 *  Versatile default; covers unknown / freeform industries. */
export const DEFAULT_BUNDLE: DesignBundleId = 'bold_direct';

/** Resolve an industry string to a bundle id. Tolerates `null`, empty
 *  strings, unknown values, and free-text industries — always returns a
 *  valid id. The match is case-insensitive on a normalised slug so
 *  "Residential Electrician" and "electrician" land on the same bundle. */
export function getBundleForIndustry(industry: string | null | undefined): DesignBundleId {
  if (!industry) return DEFAULT_BUNDLE;
  const key = normalise(industry);
  if (key in INDUSTRY_BUNDLE_DEFAULTS) return INDUSTRY_BUNDLE_DEFAULTS[key];

  // Fuzzy fallback — pick the FIRST registered key whose token appears in
  // the input. So "Residential Electrician" → "electrician" → sharp_direct.
  // Cheap O(industries × tokens) — there are only 11 keys.
  for (const known of Object.keys(INDUSTRY_BUNDLE_DEFAULTS)) {
    if (key.includes(known)) return INDUSTRY_BUNDLE_DEFAULTS[known];
  }
  return DEFAULT_BUNDLE;
}

function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
