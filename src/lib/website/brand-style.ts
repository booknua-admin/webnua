// =============================================================================
// brand-style — write a brand-level style default (font / colour) to the
// `brands` row. Replaces the localStorage `brand-style-stub` (sunset).
//
// Why a fire-and-forget mutation rather than a useMutation hook:
//   The Fields components inside the section editor mutate brand style as a
//   side effect of element-level interactions ("apply this colour to all") —
//   the call sites don't await, don't surface a loading state, and don't want
//   to thread a mutation handle through SectionFieldsProps just for this one
//   path. So we expose a plain async function with the SAME signature the
//   stub used (slug + key + value), do an optimistic cache update, fire the
//   Supabase write, and notify the builder bus on completion so every brand
//   reader (sections inheriting brand defaults, the brand editor) refetches.
//
// Cap gating: every UI call site is already inside a <CapabilityGate
// capability="editTheme"> in SiteFontsMenu / ColorField. The RLS layer on
// `brands` (migration 0088) is the real authorisation — this function just
// writes; RLS refuses an unauthorized writer.
// =============================================================================

import { getQueryClient } from '@/lib/query/getQueryClient';
import { supabase } from '@/lib/supabase/client';
import type { BrandObject } from '@/lib/website/types';

import { notifyBuilder } from './builder-events';

// Bundle C2b-1 note. The 5 keys this module covers (heading/body/background
// colour defaults + heading/body font ids) feed `section-theme.ts`'s
// per-section resolve chain — they do NOT influence the derived palette
// (which is computed from accent_color + brand_colors[1] only). Palette
// re-derivation belongs on the writers that change those columns:
// /settings/brand save (app/settings/brand/_content.tsx) and the
// onboarding wizard Step 4 (app/onboarding/_steps/Step4Brand.tsx). Both
// import `derivePalette` directly and update `derived_palette` alongside
// the colour update. See `lib/website/color-derivation.ts`.

export type BrandStyleKey =
  | 'headingFont'
  | 'bodyFont'
  | 'headingColor'
  | 'bodyColor'
  | 'backgroundColor';

const KEY_TO_COLUMN: Record<BrandStyleKey, string> = {
  headingFont: 'heading_font',
  bodyFont: 'body_font',
  headingColor: 'heading_color',
  bodyColor: 'body_color',
  backgroundColor: 'background_color',
};

// Slug → UUID resolution; cache the lookup so repeated colour edits in a
// session don't re-query.
const slugToUuid = new Map<string, string>();

async function resolveClientUuid(slug: string): Promise<string | null> {
  const cached = slugToUuid.get(slug);
  if (cached) return cached;
  const { data, error } = await supabase
    .from('clients')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (error || !data) return null;
  slugToUuid.set(slug, data.id);
  return data.id;
}

/**
 * Write a single brand-style field for a client. Fire-and-forget — call
 * sites don't await. Optimistic update lands in the React Query cache
 * immediately so every section preview re-renders; the Supabase write +
 * cache invalidation follow.
 */
export function setBrandStyleValue(
  clientSlug: string,
  key: BrandStyleKey,
  value: string,
): void {
  // 1. Optimistic update — set the field on the cached brand object so the
  //    editor's section previews reflect the change before the round-trip
  //    completes.
  const queryClient = getQueryClient();
  queryClient.setQueryData<BrandObject | null>(
    ['website', 'brand', clientSlug],
    (prev) => (prev ? { ...prev, [key]: value } : prev),
  );

  // 2. Persist to Supabase and notify the builder bus on completion. RLS
  //    refuses an unauthorized writer; on failure we refetch to restore the
  //    truth so the optimistic update gets reverted.
  void persist(clientSlug, key, value, queryClient);
}

async function persist(
  clientSlug: string,
  key: BrandStyleKey,
  value: string,
  queryClient: ReturnType<typeof getQueryClient>,
): Promise<void> {
  const clientUuid = await resolveClientUuid(clientSlug);
  if (!clientUuid) {
    // No client row — restore the cache (the optimistic write was wrong) and
    // log; this is a configuration problem, not a recoverable error.
    void queryClient.invalidateQueries({ queryKey: ['website', 'brand', clientSlug] });
    if (typeof console !== 'undefined') {
      console.warn(`[brand-style] could not resolve client slug "${clientSlug}" — write skipped`);
    }
    return;
  }
  const column = KEY_TO_COLUMN[key];
  // The five style columns are all `string | null`; build a strongly-typed
  // payload so Supabase's generated update type accepts the single field
  // update without losing safety on the unrelated columns.
  type StyleUpdate = Partial<{
    heading_font: string | null;
    body_font: string | null;
    heading_color: string | null;
    body_color: string | null;
    background_color: string | null;
  }>;
  const payload: StyleUpdate = { [column]: value } as StyleUpdate;
  const { error } = await supabase
    .from('brands')
    .update(payload)
    .eq('client_id', clientUuid);
  if (error) {
    void queryClient.invalidateQueries({ queryKey: ['website', 'brand', clientSlug] });
    if (typeof console !== 'undefined') {
      console.warn(`[brand-style] failed to write ${key}=${value} for ${clientSlug}:`, error.message);
    }
    return;
  }
  // Bump the builder event so every brand reader (the brand editor's own
  // query at ['settings','brand','row'], the section previews via
  // ['website','brand']) refetches. Optimistic update stays current.
  notifyBuilder();
  void queryClient.invalidateQueries({ queryKey: ['settings', 'brand'] });
}
