// =============================================================================
// Browser-side caller for /api/integrations/meta_ads/draft-creatives.
//
// Phase 7.5 Session 1. The launch wizard's step 4 uses this when the
// operator clicks "✦ Generate variants" — Claude (Sonnet) returns N
// variants of (headline, primaryText, description, ctaType). Each
// variant is clipped server-side to Meta's News Feed length limits;
// the wizard renders them as cards + a Meta-feed-ad preview.
//
// Fallback policy on 503 (no key configured): throw AppError.validation
// so the wizard's button settles into an inline error ("Configure
// ANTHROPIC_API_KEY"). The template's default copy (substituted with
// businessName / serviceArea) is the deterministic fallback the
// operator can use instead — they keep typing in the manual fields.
// =============================================================================

import { AppError } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';

export type AdCreativeVariant = {
  headline: string;
  primaryText: string;
  description: string;
  /** Closed CTA vocabulary from Meta — the route clips invalid values. */
  ctaType:
    | 'LEARN_MORE'
    | 'BOOK_NOW'
    | 'GET_QUOTE'
    | 'CONTACT_US'
    | 'SIGN_UP'
    | 'GET_OFFER'
    | 'APPLY_NOW';
};

export type DraftCreativesInput = {
  clientId: string;
  offer: string;
  templateSlug: string;
  businessName: string;
  serviceArea: string;
  count?: number;
};

async function accessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw AppError.auth('You are signed out — sign in again.');
  return token;
}

export async function draftMetaAdVariants(
  input: DraftCreativesInput,
): Promise<AdCreativeVariant[]> {
  const token = await accessToken();
  const response = await fetch('/api/integrations/meta_ads/draft-creatives', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
  if (response.status === 503) {
    throw AppError.validation({
      anthropic:
        'Anthropic is not configured on this deployment. Type the variants manually or ask the operator to configure ANTHROPIC_API_KEY.',
    });
  }
  if (!response.ok) {
    let body: Record<string, unknown> = {};
    try {
      body = (await response.json()) as Record<string, unknown>;
    } catch {
      // ignore
    }
    const detail =
      (typeof body.detail === 'string' && body.detail) ||
      (typeof body.error === 'string' && body.error) ||
      `Draft variants failed (${response.status}).`;
    throw AppError.unexpected(detail);
  }
  const json = (await response.json()) as { variants?: unknown };
  const variants = Array.isArray(json.variants) ? json.variants : [];
  return variants.filter(
    (v): v is AdCreativeVariant =>
      v != null &&
      typeof v === 'object' &&
      typeof (v as AdCreativeVariant).headline === 'string' &&
      typeof (v as AdCreativeVariant).primaryText === 'string',
  );
}
