// =============================================================================
// Brief completeness — the gate that decides what the "Generate my ads"
// surface shows the operator.
//
// Phase 7.5 · Session 2.1. Reads four sources and returns a discriminated
// union with three states:
//
//   • `ready: true` — every needed brand field is populated, the customer
//     has a published site, and a Meta ad account is wired. The big rust
//     button lights up.
//   • `ready: false, hardBlock` — the customer is missing infra Webnua
//     can't capture in a chat: no published site, or no Meta ad account
//     wired. Each surfaces its own remediation card; the button is
//     hidden entirely.
//   • `ready: false, missing` — the brand row is present but one or more
//     fields needed for a good Sonnet draft are blank. V1 (Session 2.1)
//     enables the button anyway and falls back to qualitative defaults
//     in the Sonnet prompt; V2 (Session 2.2) will flip the button label
//     ("✦ Generate my ads — N quick questions first") and open the
//     conversational chat.
//
// Order matters: hard blocks first. Asking the operator missing brand
// questions when the underlying infra isn't there would be useless.
//
// Reads via the RLS-scoped browser Supabase client — same path the
// operator UI uses everywhere else. The page component calls
// `useBriefCompleteness(clientId)` (below) to drive its dispatch.
// =============================================================================

import { useQuery } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase/client';

/** Soft-block fields — these need values for the Sonnet prompt to draft
 *  on-brand. The set is closed for 2.1; if a new field becomes important
 *  (e.g. service-area copy), extend the union here AND add a question
 *  to the Session 2.2 chat. */
export type BriefField = 'offer' | 'services' | 'audience_line' | 'accent_color';

export type BriefCompleteness =
  | { ready: true }
  | { ready: false; hardBlock: 'no_published_site' | 'no_ad_account' }
  | { ready: false; missing: BriefField[] };

/** Operator-facing label per field — used by the soft-block explainer
 *  copy on the Generate surface. Kept in lockstep with `BriefField`. */
export const BRIEF_FIELD_LABEL: Record<BriefField, string> = {
  offer: 'a one-line offer (the promise on the ad)',
  services: 'the services this customer sells',
  audience_line: 'a sentence about the customer they want more of',
  accent_color: 'a brand accent colour',
};

// --- raw row shapes ---------------------------------------------------------

// `brands.services` was added in migration 0112; it's not yet in the
// generated Database type so we read through an untyped cast (same
// pattern as the launch wizard's resolveClientContext).
type BrandRow = {
  accent_color: string | null;
  audience_line: string | null;
  services: string[] | null;
  top_jobs_to_be_booked: string[] | null;
  offer: unknown;
};

type WebsiteRow = {
  published_version_id: string | null;
};

type MetaAdAccountRow = {
  meta_ad_account_id: string | null;
};

function db(): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

// --- offer shape ------------------------------------------------------------

/** A `brands.offer` jsonb is "present" when its four canonical fields are
 *  non-empty strings (matches the snake_case shape `offerToRow` writes —
 *  see `lib/website/offer-generate.ts`). A partially-filled offer counts
 *  as missing because the Sonnet prompt expects all four. */
function offerIsPresent(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.headline === 'string' &&
    o.headline.trim().length > 0 &&
    typeof o.promise === 'string' &&
    o.promise.trim().length > 0
  );
}

// --- main read --------------------------------------------------------------

export async function getBriefCompleteness(
  clientId: string,
): Promise<BriefCompleteness> {
  const [brandRes, websiteRes, adAccountRes] = await Promise.all([
    db()
      .from('brands')
      .select('accent_color, audience_line, services, top_jobs_to_be_booked, offer')
      .eq('client_id', clientId)
      .maybeSingle(),
    db()
      .from('websites')
      .select('published_version_id')
      .eq('client_id', clientId)
      .maybeSingle(),
    db()
      .from('client_meta_ad_accounts')
      .select('meta_ad_account_id')
      .eq('client_id', clientId)
      .maybeSingle(),
  ]);

  // Hard blocks first — infra the chat can't fix.
  const website = (websiteRes.data as WebsiteRow | null) ?? null;
  if (!website || !website.published_version_id) {
    return { ready: false, hardBlock: 'no_published_site' };
  }
  const adAccount = (adAccountRes.data as MetaAdAccountRow | null) ?? null;
  if (!adAccount || !adAccount.meta_ad_account_id) {
    return { ready: false, hardBlock: 'no_ad_account' };
  }

  // Soft blocks — fields the chat (Session 2.2) will ask about.
  const brand = (brandRes.data as BrandRow | null) ?? null;
  const missing: BriefField[] = [];
  if (!brand || !offerIsPresent(brand.offer)) missing.push('offer');
  // services prefers `services[]` (the full menu, migration 0112) but
  // falls back to `top_jobs_to_be_booked` for back-compat with brand
  // rows seeded before that migration applied.
  const servicesPool = (brand?.services?.length ?? 0) > 0
    ? brand?.services
    : brand?.top_jobs_to_be_booked;
  if (!servicesPool || servicesPool.length === 0) missing.push('services');
  if (!brand || !brand.audience_line || brand.audience_line.trim().length === 0) {
    missing.push('audience_line');
  }
  if (!brand || !brand.accent_color || brand.accent_color.trim().length === 0) {
    missing.push('accent_color');
  }

  if (missing.length > 0) {
    return { ready: false, missing };
  }
  return { ready: true };
}

// --- React Query hook -------------------------------------------------------

const briefCompletenessKey = (clientId: string | null) =>
  ['brief-completeness', clientId] as const;

export function useBriefCompleteness(clientId: string | null) {
  return useQuery({
    queryKey: briefCompletenessKey(clientId),
    queryFn: () => getBriefCompleteness(clientId as string),
    enabled: clientId != null && clientId.length > 0,
    // Re-check on window focus — a Meta connect / publish in another tab
    // should unblock the Generate button without a hard refresh.
    refetchOnWindowFocus: true,
  });
}
