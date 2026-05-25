// =============================================================================
// generation-validation — shared post-AI repair pipeline for the website +
// funnel generators.
//
// Server-safe (no 'use client') — both `runValidationPipeline`
// (generation-stub.ts) and `validateAndAssemble` (generate-funnel-live.ts)
// import the helpers below. The four passes run on every section after the
// AI returns, before the section is committed to the editor:
//
//   1. validateEnums           — enforce SECTION_SHAPE_CATALOG enum membership
//   2. stripHallucinatedImages — clear "invented" image paths like /images/x.jpg
//   3. injectStockImages       — fill empty image slots from the industry kit
//   4. reconcileColumns        — clamp `columns` down to `items.length`
//
// Order matters: hallucinated paths are stripped BEFORE stock injection so
// the same field gets repaired (a fresh stock URL replaces the cleared
// hallucination, not the other way around).
//
// All four return `{ data, fallbacks }` so the parent pipeline can append
// the fallback entries onto its own log and persist them to
// `public.generation_log` via the route writer.
//
// Bundle A / Bundle B. See `reference/bundle-a-b-audit.md`.
// =============================================================================

import { SECTION_SHAPE_CATALOG } from './generation-prompt';
import type { FallbackLogEntry } from './generation-stub';
import {
  type IndustryKey,
  type IndustryTemplate,
  resolveIndustryTemplate,
} from './industry-templates';
import type { SectionType } from './types';

// -- Shared building blocks -------------------------------------------------

export type PipelineFallback = Omit<FallbackLogEntry, 'generationId'>;

type RepairResult = {
  data: Record<string, unknown>;
  fallbacks: PipelineFallback[];
};

function shallowClone(data: Record<string, unknown>): Record<string, unknown> {
  return { ...data };
}

// =============================================================================
// Pass 1 — enum validation
// =============================================================================

/** Sections where a section-level enum constraint is sometimes overridden
 *  by another field. e.g. `cta.layout='dual'` makes `panelA`/`panelB` valid
 *  but irrelevant otherwise; we still validate `layout` itself. None of the
 *  catalog entries are cross-field dependent today — placeholder for the
 *  future. */
const ENUM_OVERRIDES: Partial<Record<SectionType, never>> = {};

/** Walk every variant key the catalog declares for a section and check the
 *  emitted value against the allowed list. Invalid values are substituted
 *  with the catalog's FIRST listed value (documented elsewhere as the
 *  "safer default"); missing values are left alone — the parent pipeline's
 *  missing-field reporting picks those up. Each substitution emits a
 *  fallback entry with `reason='invalid'` so `generation_log` carries the
 *  rejected value for telemetry. */
export function validateEnums(
  type: SectionType,
  data: Record<string, unknown>,
): RepairResult {
  // Mark `ENUM_OVERRIDES` as intentionally consulted — the lookup itself
  // currently has no entries, but the indirection keeps a future cross-
  // field rule from re-architecting the call sites.
  void ENUM_OVERRIDES[type];
  const shape = SECTION_SHAPE_CATALOG[type];
  if (!shape) {
    return { data, fallbacks: [] };
  }
  const out = shallowClone(data);
  const fallbacks: PipelineFallback[] = [];
  for (const variant of shape.variants) {
    const value = out[variant.key];
    if (value === undefined || value === null) continue;
    if (variant.values.some((v) => v === value)) continue;
    // Substitute with the catalog's first listed value.
    const replacement = variant.values[0];
    out[variant.key] = replacement;
    fallbacks.push({
      sectionType: type,
      fieldName: variant.key,
      reason: 'invalid',
      modelValue: value,
    });
  }
  return { data: out, fallbacks };
}

// =============================================================================
// Pass 2 — hallucinated image-path stripping
// =============================================================================

/** Asset path prefixes the renderer is willing to serve. Anything else
 *  starting with `/` is the model inventing a local path that 404s in
 *  production (audit found `/images/work-extension-1.jpg`-style strings in
 *  ~14-18% of image fields). */
const KNOWN_LOCAL_ASSET_PREFIXES: readonly string[] = [
  '/_next/',
  '/static/',
  '/assets/',
  // The Supabase Storage proxy used by section-media uploads.
  '/storage/',
  // Public-render renderer (the future public-site pipeline writes here).
  '/public/',
];

/** Single-string image fields per section type. Item-array image fields are
 *  declared separately (each row's `imageUrl`). */
const SINGLE_IMAGE_FIELDS: Partial<Record<SectionType, readonly string[]>> = {
  hero: ['heroImageUrl'],
  cta: ['imageUrl'],
  about: ['imageUrl', 'imageUrl2', 'imageUrl3'],
  contact: ['imageUrl', 'mapImageUrl'],
  offer: ['imageUrl'],
  reviews: ['spotlightImageUrl'],
  header: ['logoImageUrl'],
  footer: ['logoImageUrl'],
};

/** Item-array image fields. For each (sectionType, arrayKey) we strip
 *  `arr[i].imageUrl` when invalid. */
const ITEM_IMAGE_FIELDS: Partial<
  Record<SectionType, readonly { array: string; key: string }[]>
> = {
  gallery: [{ array: 'items', key: 'imageUrl' }],
  features: [{ array: 'items', key: 'imageUrl' }],
  trust: [{ array: 'items', key: 'imageUrl' }],
  reviews: [{ array: 'items', key: 'avatarUrl' }],
};

/** True for a URL string the renderer can use. */
function isAcceptableUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  if (v === '') return false;
  if (v.startsWith('http://') || v.startsWith('https://')) return true;
  if (v.startsWith('data:image/')) return true;
  if (v.startsWith('/')) {
    return KNOWN_LOCAL_ASSET_PREFIXES.some((p) => v.startsWith(p));
  }
  return false;
}

/** Strip any image-bearing field that holds a hallucinated path. A field
 *  becomes empty string (the renderer's "no image" sentinel) and an
 *  `invalid` fallback is recorded carrying the bad URL. Pass 3
 *  (`injectStockImages`) runs immediately after, refilling the cleared
 *  slot from the industry kit. */
export function stripHallucinatedImages(
  type: SectionType,
  data: Record<string, unknown>,
): RepairResult {
  const out = shallowClone(data);
  const fallbacks: PipelineFallback[] = [];

  for (const field of SINGLE_IMAGE_FIELDS[type] ?? []) {
    const value = out[field];
    if (value === undefined || value === null || value === '') continue;
    if (isAcceptableUrl(value)) continue;
    out[field] = '';
    fallbacks.push({
      sectionType: type,
      fieldName: field,
      reason: 'invalid',
      modelValue: value,
    });
  }

  for (const { array, key } of ITEM_IMAGE_FIELDS[type] ?? []) {
    const items = out[array];
    if (!Array.isArray(items)) continue;
    let touched = false;
    const nextItems = items.map((raw, index) => {
      if (typeof raw !== 'object' || raw === null) return raw;
      const item = raw as Record<string, unknown>;
      const value = item[key];
      if (value === undefined || value === null || value === '') return item;
      if (isAcceptableUrl(value)) return item;
      touched = true;
      fallbacks.push({
        sectionType: type,
        fieldName: `${array}[${index}].${key}`,
        reason: 'invalid',
        modelValue: value,
      });
      return { ...item, [key]: '' };
    });
    if (touched) out[array] = nextItems;
  }

  return { data: out, fallbacks };
}

// =============================================================================
// Pass 3 — stock-image injection
// =============================================================================

/** A pure helper for the deterministic fallback path AND the live path.
 *  Takes (industry, sectionType, fieldKey, optional index) and returns the
 *  matching curated URL — or an empty string if the industry kit can't
 *  supply one. Index is used for arrays (gallery items, about's
 *  imageUrl2/imageUrl3) so a same-industry page doesn't put the same photo
 *  in two slots when alternatives exist. */
export function resolveStockImage(
  industry: IndustryKey | string,
  sectionType: SectionType,
  fieldKey: string,
  index = 0,
): string {
  const template = resolveIndustryTemplate(industry);
  return pickTemplateUrl(template, sectionType, fieldKey, index);
}

function pickTemplateUrl(
  template: IndustryTemplate,
  sectionType: SectionType,
  fieldKey: string,
  index: number,
): string {
  const gallery = template.stockImages.gallery;
  const team = template.stockImages.team ?? '';

  // Hero-shaped slots: single big "we do this work" image.
  if (sectionType === 'hero' && fieldKey === 'heroImageUrl') {
    return template.stockImages.hero;
  }
  if (sectionType === 'cta' && fieldKey === 'imageUrl') {
    // Use the second gallery image for CTA so it differs from the hero on
    // the same page when alternatives exist; fall back to hero otherwise.
    return gallery[1] ?? template.stockImages.hero;
  }
  if (sectionType === 'offer' && fieldKey === 'imageUrl') {
    return gallery[2] ?? template.stockImages.hero;
  }
  if (sectionType === 'reviews' && fieldKey === 'spotlightImageUrl') {
    return team || gallery[0] || template.stockImages.hero;
  }

  // About — supports a primary + two collage slots.
  if (sectionType === 'about') {
    if (fieldKey === 'imageUrl') return team || template.stockImages.hero;
    if (fieldKey === 'imageUrl2') return gallery[0] ?? '';
    if (fieldKey === 'imageUrl3') return gallery[1] ?? '';
  }

  // Contact — optional brand photo, the `mapImageUrl` is operator-supplied.
  if (sectionType === 'contact' && fieldKey === 'imageUrl') {
    return gallery[0] ?? template.stockImages.hero;
  }

  // Gallery items — index into the curated gallery array.
  if (sectionType === 'gallery' && fieldKey === 'items[i].imageUrl') {
    const url = gallery[index];
    if (url) return url;
    return gallery[gallery.length - 1] ?? template.stockImages.hero;
  }

  // Trust items - operator brand mark slots, no stock equivalent.
  // Features items - icon-led, no stock equivalent for the small thumbnails.
  // Reviews item avatars - synthetic faces would be misleading; leave empty.

  return '';
}

/** Fill empty image slots from the industry kit. Runs AFTER hallucinated
 *  paths have been stripped (Pass 2), so a field cleared by the strip pass
 *  gets refilled here. Every injection emits a `missing` fallback whose
 *  `modelValue` carries the URL we injected — that string is the audit
 *  signal that distinguishes "we filled it" from "we left it empty". */
export function injectStockImages(
  type: SectionType,
  data: Record<string, unknown>,
  industry: IndustryKey | string,
): RepairResult {
  const out = shallowClone(data);
  const fallbacks: PipelineFallback[] = [];

  for (const field of SINGLE_IMAGE_FIELDS[type] ?? []) {
    // The `header.logoImageUrl` / `footer.logoImageUrl` slots are
    // operator-uploaded brand marks — never inject a stock image there.
    if (
      (type === 'header' || type === 'footer') &&
      field === 'logoImageUrl'
    ) {
      continue;
    }
    const value = out[field];
    if (typeof value === 'string' && value.trim() !== '') continue;
    const injected = resolveStockImage(industry, type, field);
    if (!injected) continue;
    out[field] = injected;
    fallbacks.push({
      sectionType: type,
      fieldName: field,
      reason: 'missing',
      modelValue: injected,
    });
  }

  // Gallery items — fill each empty `imageUrl` with the matching gallery
  // index. Item arrays are only walked when they exist; we don't fabricate
  // items the AI didn't emit.
  if (type === 'gallery' && Array.isArray(out.items)) {
    let touched = false;
    const nextItems = (out.items as unknown[]).map((raw, index) => {
      if (typeof raw !== 'object' || raw === null) return raw;
      const item = raw as Record<string, unknown>;
      const cur = item.imageUrl;
      if (typeof cur === 'string' && cur.trim() !== '') return item;
      const injected = resolveStockImage(
        industry,
        'gallery',
        'items[i].imageUrl',
        index,
      );
      if (!injected) return item;
      touched = true;
      fallbacks.push({
        sectionType: 'gallery',
        fieldName: `items[${index}].imageUrl`,
        reason: 'missing',
        modelValue: injected,
      });
      return { ...item, imageUrl: injected };
    });
    if (touched) out.items = nextItems;
  }

  return { data: out, fallbacks };
}

// =============================================================================
// Pass 4 — items vs columns reconciliation
// =============================================================================

/** Sections that pair an `items` array with a `columns` grid count. When
 *  the AI emits fewer items than columns, the renderer pads with empty
 *  cards (the "3 cards in a 4-slot grid" symptom). Clamp `columns` down
 *  to the actual item count so the grid is naturally balanced. We do NOT
 *  trim items when `length > columns * 3` — the model wanted that many
 *  and a wrap onto a fourth row is fine. */
const COLUMNS_FIELDS: Partial<Record<SectionType, string>> = {
  features: 'columns',
  gallery: 'columns',
  reviews: 'columns',
  faq: 'columns',
  trust: 'columns',
  offer: 'columns',
};

export function reconcileColumns(
  type: SectionType,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const colKey = COLUMNS_FIELDS[type];
  if (!colKey) return data;
  const items = data.items;
  const columns = data[colKey];
  if (
    !Array.isArray(items) ||
    typeof columns !== 'number' ||
    !Number.isFinite(columns)
  ) {
    return data;
  }
  if (items.length === 0) return data;
  if (items.length >= columns) return data;
  return { ...data, [colKey]: items.length };
}

// =============================================================================
// Resolve the industry string a section should inject against
// =============================================================================

/** Pull the industry key out of either GenerationContext.brand or a funnel
 *  LiveBrief — both pipelines call into here with their own shape. */
export type IndustryResolveSource = {
  brand?: { industryCategory?: string };
  industry?: string;
};

export function resolveIndustryString(
  source: IndustryResolveSource,
): IndustryKey | string {
  return (
    source.industry ||
    source.brand?.industryCategory ||
    'generic'
  );
}
