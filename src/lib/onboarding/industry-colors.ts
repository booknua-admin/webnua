// =============================================================================
// onboarding/industry-colors — per-industry primary-colour defaults for the
// wizard's brand step.
//
// The industry templates (`lib/website/industry-templates.ts`) carry rich
// per-trade context for the generator but NOT a default brand colour — the
// generator never picked one. Pattern B's wizard surfaces a colour picker
// pre-filled with an industry-appropriate hue so the customer's first
// preview already looks differentiated from the next tradie's, and a
// customer who skips the brand step still ends up with a coloured site
// instead of Webnua rust on every workspace.
//
// Choice rationale:
//   - emergency-callout trades (electrician/plumber/locksmith) lean warm /
//     high-contrast → confidence + urgency.
//   - scheduled service trades (cleaner/landscaper) lean soft + clean →
//     low-anxiety, trustworthy.
//   - project trades (painter/carpenter) lean neutral / craftsman → quality.
//   - mixed trades (handyman/hvac/roofer) lean practical, mid-saturation.
//
// All values are 7-character lowercase hex (#rrggbb). The brand-edit code
// downstream (lib/website/brand-style.ts and the brand editor) treats hex
// as the canonical colour format.
//
// **NOT a permanent decision** — the customer overrides via the wizard's
// step 4 colour picker, and post-publish via /settings/brand. This is the
// SEED only.
// =============================================================================

import type { IndustryKey } from '@/lib/website/industry-templates';

/** Industry → default primary colour. Every IndustryKey resolves; `generic`
 *  carries the Webnua rust so a fully-unknown trade still produces a colour
 *  the rest of the design system tolerates. */
export const INDUSTRY_PRIMARY_COLORS: Record<IndustryKey, string> = {
  // Emergency-callout — warm, high-energy.
  electrician: '#f59e0b', // amber/electric yellow
  plumber: '#2563eb', // signal blue
  locksmith: '#475569', // slate (steel)

  // Scheduled service — soft + clean.
  cleaner: '#10b981', // mint green
  landscaper: '#16a34a', // grass green

  // Project — neutral / craftsman.
  painter: '#dc2626', // signal red (paint)
  carpenter: '#92400e', // walnut brown

  // Mixed — practical mid-saturation.
  handyman: '#ea580c', // tradie orange
  hvac: '#0891b2', // cool cyan (heating + cooling)
  roofer: '#7c2d12', // tile brown

  // Catch-all for any service business outside the 10 curated trades
  // (car valet, dog grooming, personal trainer, accountant, photographer,
  // physio, tutor, etc.). Deliberately NOT Webnua rust (`#d24317`) — that
  // is the platform's brand colour and reusing it as a customer default
  // makes every catch-all signup look like the Webnua marketing site at
  // first glance. Professional blue reads as "any service business,
  // anywhere" without claiming a trade category. Customer overrides via
  // the wizard's step 4 / the conversational turn 3 colour picker.
  generic: '#3b6ba5',
};

/** Derive a sensible secondary colour from a primary. Used as the step 4
 *  default until the customer overrides. Pure heuristic: shift the
 *  primary by ~20% darker for a "deeper" sibling. Real brand palettes
 *  carry their own secondary; this is just a not-bad starting point so
 *  the customer isn't forced to make two colour decisions when they only
 *  care about one.
 *
 *  Returns a 7-character lowercase hex string. Invalid input is echoed
 *  back unchanged (graceful degrade — never throws). */
export function deriveSecondaryColor(primary: string): string {
  const match = /^#([0-9a-f]{6})$/i.exec(primary.trim());
  if (!match) return primary;
  const hex = match[1].toLowerCase();
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const shift = (channel: number): number => Math.max(0, Math.round(channel * 0.78));
  const toHex = (n: number): string => n.toString(16).padStart(2, '0');
  return `#${toHex(shift(r))}${toHex(shift(g))}${toHex(shift(b))}`;
}
