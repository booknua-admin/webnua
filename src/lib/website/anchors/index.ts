// =============================================================================
// Anchor library — barrel export.
//
// Five worked-example brands spanning the buying-motivation variance budget
// for service-business marketing. Replaces the single hardcoded Voltline
// example in `generation-prompt.ts` once the wiring is in place.
//
// Each anchor's `meta` carries the selection signals (`buyingMotivation` +
// `urgencyMode` + `industry`) and internal commentary. `meta` is NOT for
// the model — strip it before composing the prompt.
//
// Variance covered:
//   - speed (Crown Electric)            — emergency electrician, dense
//   - craft (House of Mara)             — premium bathroom fitter, magazine
//   - proximity (Bright & Co.)          — suburban cleaner, neighbour-named
//   - transformation (Field & Hedge)    — family landscaper, gallery-led
//   - simplicity (Dave Connolly)        — handyman, 4 sections, 90s read
//
// Section count distribution: 9 / 6 / 7 / 5 / 4 — teaches the model that
// page length is a brand choice, not a default.
// =============================================================================

import { anchorCrownElectric } from './anchor-01-crown-electric';
import { anchorHouseOfMara } from './anchor-02-house-of-mara';
import { anchorBrightAndCo } from './anchor-03-bright-and-co';
import { anchorFieldAndHedge } from './anchor-04-field-and-hedge';
import { anchorDaveConnolly } from './anchor-05-dave-connolly';
import type { Anchor } from './types';

export type { Anchor, AnchorMeta, AnchorBrief, AnchorPage, BuyingMotivation, UrgencyMode } from './types';

export const ANCHOR_LIBRARY: readonly Anchor[] = [
  anchorCrownElectric,
  anchorHouseOfMara,
  anchorBrightAndCo,
  anchorFieldAndHedge,
  anchorDaveConnolly,
] as const;

export {
  anchorCrownElectric,
  anchorHouseOfMara,
  anchorBrightAndCo,
  anchorFieldAndHedge,
  anchorDaveConnolly,
};
