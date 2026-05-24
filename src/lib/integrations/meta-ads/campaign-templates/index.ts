// =============================================================================
// Campaign-template registry — every Meta lead-gen template Webnua ships.
//
// Phase 7 Meta Ads. 9 trade-category templates + the catch-all 'other'.
// Operators pick from this list in the launch wizard; the launch flow
// (campaign-launch.ts) reads the template + the operator overrides + the
// client brief, composes the Meta API payloads, and calls 5 endpoints in
// sequence.
//
// SCAFFOLDS — every template carries TODOs flagging the per-launch tasks
// the operator must do (resolve Meta interest IDs, upload imagery, pin
// the privacy-policy URL). See each template's `preLaunchChecklist`.
//
// SERVER + CLIENT safe — pure data only.
// =============================================================================

import type { CampaignTemplate, CampaignTemplateSlug } from './types';

import { BUILDER_TEMPLATE } from './builder';
import { CLEANER_TEMPLATE } from './cleaner';
import { ELECTRICIAN_TEMPLATE } from './electrician';
import { HVAC_TEMPLATE } from './hvac';
import { LANDSCAPER_TEMPLATE } from './landscaper';
import { LOCKSMITH_TEMPLATE } from './locksmith';
import { OTHER_TEMPLATE } from './other';
import { PAINTER_TEMPLATE } from './painter';
import { PLUMBER_TEMPLATE } from './plumber';

export * from './types';

/** All registered templates, in display order. */
export const CAMPAIGN_TEMPLATES: readonly CampaignTemplate[] = [
  ELECTRICIAN_TEMPLATE,
  PLUMBER_TEMPLATE,
  HVAC_TEMPLATE,
  BUILDER_TEMPLATE,
  LOCKSMITH_TEMPLATE,
  CLEANER_TEMPLATE,
  LANDSCAPER_TEMPLATE,
  PAINTER_TEMPLATE,
  OTHER_TEMPLATE,
] as const;

const BY_SLUG: Record<CampaignTemplateSlug, CampaignTemplate> = {
  electrician: ELECTRICIAN_TEMPLATE,
  plumber: PLUMBER_TEMPLATE,
  hvac: HVAC_TEMPLATE,
  builder: BUILDER_TEMPLATE,
  locksmith: LOCKSMITH_TEMPLATE,
  cleaner: CLEANER_TEMPLATE,
  landscaper: LANDSCAPER_TEMPLATE,
  painter: PAINTER_TEMPLATE,
  other: OTHER_TEMPLATE,
};

export function getCampaignTemplate(slug: CampaignTemplateSlug): CampaignTemplate {
  return BY_SLUG[slug];
}

export function isCampaignTemplateSlug(value: string): value is CampaignTemplateSlug {
  return Object.prototype.hasOwnProperty.call(BY_SLUG, value);
}

/**
 * Best-effort match from a free-text industry label to a template slug.
 * Used by the launch wizard to pre-select a sensible default for the
 * client's industry string. Always returns 'other' as the fallback.
 */
export function suggestTemplateForIndustry(industry: string | null | undefined): CampaignTemplateSlug {
  const i = (industry ?? '').toLowerCase();
  if (i.includes('electric')) return 'electrician';
  if (i.includes('plumb')) return 'plumber';
  if (i.includes('hvac') || i.includes('heat') || i.includes('air condition')) return 'hvac';
  if (i.includes('build') || i.includes('renovation') || i.includes('extension')) return 'builder';
  if (i.includes('lock')) return 'locksmith';
  if (i.includes('clean')) return 'cleaner';
  if (i.includes('landscap') || i.includes('garden')) return 'landscaper';
  if (i.includes('paint')) return 'painter';
  return 'other';
}
