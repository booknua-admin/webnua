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

/** Surface the section belongs to. `'site'` = a website page; `'funnel'` =
 *  a funnel step. Used as a seed token so the same (industry, section,
 *  field) on a website and on its sibling funnel never collide on the
 *  identical hero — see `resolveStockImage`. */
export type StockImageSurface = 'site' | 'funnel';

/** A deterministic 32-bit FNV-1a hash of a string. Pure, no I/O. Used as
 *  the slot-diversity seed: a hash of `${slug}:${sectionType}:${fieldKey}`
 *  picks a stable gallery index per slot, so the same site always gets the
 *  same photo per slot (no churn on re-render) but different slots on the
 *  same page pick different photos when alternatives exist. */
function fnv1aHash(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // 32-bit FNV prime multiply, kept inside 32-bit via Math.imul.
    hash = Math.imul(hash, 0x01000193);
  }
  // Coerce to unsigned 32-bit so the consumer can take a positive modulo.
  return hash >>> 0;
}

/** Options carried through every injection call to drive slot diversity.
 *  Optional fields fall back to fixed positions when absent (the pre-C1
 *  behaviour) so the helper stays callable from the deterministic-fallback
 *  path which has no slug. */
export type StockImageOptions = {
  /** Stable per-site identifier — usually `clients.slug`. Hashed with the
   *  field key to pick a gallery index. When absent, falls back to fixed
   *  positions (the pre-C1 behaviour: gallery[0/1/2] per slot). */
  slug?: string;
  /** `'site'` vs `'funnel'`. Lets a customer's website + funnel never
   *  collide on the identical hero, since the surface token rides in the
   *  hash key. Defaults to `'site'`. */
  surface?: StockImageSurface;
  /** Item index inside an array field (gallery items only). Used as the
   *  per-item offset so a 4-item gallery keeps its sequential variety while
   *  the per-site starting offset rotates. */
  index?: number;
};

/** A pure helper for the deterministic fallback path AND the live path.
 *  Takes (industry, sectionType, fieldKey, options) and returns the
 *  matching curated URL — or an empty string if the industry kit can't
 *  supply one. The options carry the per-site slug + surface that drive
 *  per-slot diversity (C1). When the slug is absent the helper falls back
 *  to fixed positions (pre-C1 behaviour) so the deterministic fallback
 *  generator still works without a slug. */
export function resolveStockImage(
  industry: IndustryKey | string,
  sectionType: SectionType,
  fieldKey: string,
  options: StockImageOptions = {},
): string {
  const template = resolveIndustryTemplate(industry);
  return pickTemplateUrl(template, sectionType, fieldKey, options);
}

/** Pick a gallery index for a given (slug, surface, sectionType, fieldKey)
 *  tuple. The hash is stable per-tuple, so re-renders never churn the
 *  selection. The same site reliably gets the same photo per slot. When
 *  `slug` is absent, returns `fallbackIndex` (the pre-C1 fixed position) so
 *  deterministic-fallback callers without a slug see no behaviour change. */
function pickGalleryIndex(
  slug: string | undefined,
  surface: StockImageSurface,
  sectionType: SectionType,
  fieldKey: string,
  galleryLength: number,
  fallbackIndex: number,
): number {
  if (galleryLength <= 0) return 0;
  if (!slug) {
    // No slug: behave like pre-C1 (fixed positions). Clamp the fixed
    // position into range so a sparse gallery can't out-of-bounds.
    return Math.min(fallbackIndex, galleryLength - 1);
  }
  const seed = `${slug}:${surface}:${sectionType}:${fieldKey}`;
  return fnv1aHash(seed) % galleryLength;
}

function pickTemplateUrl(
  template: IndustryTemplate,
  sectionType: SectionType,
  fieldKey: string,
  options: StockImageOptions,
): string {
  const gallery = template.stockImages.gallery;
  const team = template.stockImages.team ?? '';
  const slug = options.slug;
  const surface: StockImageSurface = options.surface ?? 'site';
  const heroFallback = template.stockImages.hero;

  // Hero-shaped slots: a single big "we do this work" image. With a slug
  // present, pick a hero/gallery slot via the per-slot hash so the funnel
  // hero never lands on the same photo as the website hero of the same
  // brand (`surface` rides in the hash key, guaranteeing distinctness).
  if (sectionType === 'hero' && fieldKey === 'heroImageUrl') {
    if (!slug) return heroFallback;
    // Site hero CAN be the template's headline `hero` URL; the funnel hero
    // must be DIFFERENT, so we exclude index 0 of the [hero, ...gallery]
    // pool when surface === 'funnel' AND alternatives exist. We treat the
    // template's `hero` as pool index 0 and the gallery items as 1..N.
    const pool: readonly string[] = [heroFallback, ...gallery];
    if (surface === 'funnel' && pool.length > 1) {
      // Funnel: pick from gallery only (skip pool[0] = template hero).
      const idx = pickGalleryIndex(slug, surface, sectionType, fieldKey, gallery.length, 0);
      return gallery[idx] ?? heroFallback;
    }
    // Site: hash across the full pool, biased to start at hero by including
    // it as index 0 — site visitors see the curated hero unless the hash
    // rotates them onto a gallery photo, which is fine variety.
    const idx = pickGalleryIndex(slug, surface, sectionType, fieldKey, pool.length, 0);
    return pool[idx] ?? heroFallback;
  }

  if (sectionType === 'cta' && fieldKey === 'imageUrl') {
    // Pre-C1: gallery[1] (fixed). With a slug: hash across the full gallery
    // so two CTA sections on the same page can land on different photos.
    if (gallery.length === 0) return heroFallback;
    const idx = pickGalleryIndex(slug, surface, sectionType, fieldKey, gallery.length, 1);
    return gallery[idx] ?? heroFallback;
  }

  if (sectionType === 'offer' && fieldKey === 'imageUrl') {
    if (gallery.length === 0) return heroFallback;
    const idx = pickGalleryIndex(slug, surface, sectionType, fieldKey, gallery.length, 2);
    return gallery[idx] ?? heroFallback;
  }

  if (sectionType === 'reviews' && fieldKey === 'spotlightImageUrl') {
    // Prefer the team portrait if the template carries one; otherwise pick
    // a gallery slot via the hash so reviews don't collide with hero/cta.
    if (team) return team;
    if (gallery.length === 0) return heroFallback;
    const idx = pickGalleryIndex(slug, surface, sectionType, fieldKey, gallery.length, 0);
    return gallery[idx] ?? heroFallback;
  }

  // About — supports a primary + two collage slots. Each slot hashes with
  // its own fieldKey, so the three slots reliably pick three different
  // photos when the gallery is ≥3 wide.
  if (sectionType === 'about') {
    if (fieldKey === 'imageUrl') {
      if (team) return team;
      if (gallery.length === 0) return heroFallback;
      const idx = pickGalleryIndex(slug, surface, sectionType, fieldKey, gallery.length, 0);
      return gallery[idx] ?? heroFallback;
    }
    if (fieldKey === 'imageUrl2') {
      if (gallery.length === 0) return '';
      const idx = pickGalleryIndex(slug, surface, sectionType, fieldKey, gallery.length, 1);
      return gallery[idx] ?? '';
    }
    if (fieldKey === 'imageUrl3') {
      if (gallery.length === 0) return '';
      const idx = pickGalleryIndex(slug, surface, sectionType, fieldKey, gallery.length, 2);
      return gallery[idx] ?? '';
    }
  }

  // Contact — optional brand photo, the `mapImageUrl` is operator-supplied.
  if (sectionType === 'contact' && fieldKey === 'imageUrl') {
    if (gallery.length === 0) return heroFallback;
    const idx = pickGalleryIndex(slug, surface, sectionType, fieldKey, gallery.length, 0);
    return gallery[idx] ?? heroFallback;
  }

  // Gallery items — each item lands on its own gallery index. The index is
  // (perSiteOffset + i) mod galleryLength so the per-site offset rotates
  // the starting photo without losing the sequential per-item variety.
  if (sectionType === 'gallery' && fieldKey === 'items[i].imageUrl') {
    if (gallery.length === 0) return heroFallback;
    const itemIndex = options.index ?? 0;
    if (!slug) {
      const url = gallery[itemIndex];
      if (url) return url;
      return gallery[gallery.length - 1] ?? heroFallback;
    }
    // Per-site starting offset (hashed once for the array, not per item).
    const offset =
      fnv1aHash(`${slug}:${surface}:${sectionType}:${fieldKey}`) % gallery.length;
    const idx = (offset + itemIndex) % gallery.length;
    return gallery[idx] ?? gallery[0] ?? heroFallback;
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
 *  signal that distinguishes "we filled it" from "we left it empty".
 *
 *  C1: takes an optional `options` carrying `{ slug, surface }`. The slug
 *  drives per-slot hash-based diversity (so the same site picks consistent
 *  but distinct photos across its hero / cta / about / contact slots), and
 *  `surface` guarantees a customer's website hero and funnel hero never
 *  collide on the same photo. */
export function injectStockImages(
  type: SectionType,
  data: Record<string, unknown>,
  industry: IndustryKey | string,
  options: StockImageOptions = {},
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
    const injected = resolveStockImage(industry, type, field, options);
    if (!injected) continue;
    out[field] = injected;
    fallbacks.push({
      sectionType: type,
      fieldName: field,
      reason: 'missing',
      modelValue: injected,
    });
  }

  // Gallery items — fill each empty `imageUrl`. The per-site offset (from
  // the slug hash) rotates the starting photo; the item index advances
  // through the gallery so the four items still pick four distinct photos
  // when the gallery is 4 wide. Item arrays are only walked when they
  // exist; we don't fabricate items the AI didn't emit.
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
        { ...options, index },
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
