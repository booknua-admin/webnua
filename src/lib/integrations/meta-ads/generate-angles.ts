// =============================================================================
// Browser-side caller for /api/integrations/meta_ads/generate-angles.
//
// Phase 7.5 · Session 2.1. The Generate surface's big rust button calls
// this on click — Webnua AI returns three differentiated ad angles
// (pain-led / outcome-led / trust-led), each with its own rationale
// + 2-3 copy variants the picker renders inline.
//
// Sibling of creative-draft.ts — same shape, same fallback policy.
// Fallback policy on 503 (no key configured): throw AppError.validation
// so the Generate surface surfaces an inline "configure
// ANTHROPIC_API_KEY" message. There is no deterministic fallback here
// — the whole point of the surface is real AI-drafted angles; a stub
// would mislead the operator.
// =============================================================================

import { AppError } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';

import type { AdCreativeVariant } from './creative-draft';

/** The three Suby/Sultanic angle archetypes — see the design doc.
 *  Closed-set union so the picker UI can switch on it for tone hints. */
export type AngleId = 'pain' | 'outcome' | 'trust';

export type GeneratedAngle = {
  id: AngleId;
  /** "Pain-led" / "Outcome-led" / "Trust-led" — display label. */
  label: string;
  /** One-sentence "why this angle for this customer" — surfaced on the
   *  picker card under the label so the operator can pick informed. */
  rationale: string;
  /** 2-3 copy variants tuned to the angle. Each variant becomes an ad
   *  set inside the picked angle when launched (matrix architecture
   *  from Session 1.4a — angle = the copy axis). */
  variants: AdCreativeVariant[];
  /** The model's preferred CTA for this angle. The launch payload uses the
   *  variant-level ctaType, but this is the angle-level recommendation
   *  the picker card surfaces alongside the rationale. */
  suggestedCtaType: AdCreativeVariant['ctaType'];
};

export type GenerateAnglesInput = {
  clientId: string;
};

async function accessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw AppError.auth('You are signed out — sign in again.');
  return token;
}

export async function generateMetaAdAngles(
  input: GenerateAnglesInput,
): Promise<GeneratedAngle[]> {
  const token = await accessToken();
  const response = await fetch('/api/integrations/meta_ads/generate-angles', {
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
        'Anthropic is not configured on this deployment. Ask the operator to set ANTHROPIC_API_KEY.',
    });
  }
  if (response.status === 429) {
    let body: Record<string, unknown> = {};
    try {
      body = (await response.json()) as Record<string, unknown>;
    } catch {
      // ignore
    }
    const detail =
      typeof body.detail === 'string'
        ? body.detail
        : 'You have hit the daily limit for angle generation — try again tomorrow.';
    throw AppError.validation({ rateLimited: detail });
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
      `Angle generation failed (${response.status}).`;
    throw AppError.unexpected(detail);
  }
  const json = (await response.json()) as { angles?: unknown };
  const angles = Array.isArray(json.angles) ? json.angles : [];
  return angles.filter(isGeneratedAngle);
}

function isGeneratedAngle(value: unknown): value is GeneratedAngle {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    (v.id === 'pain' || v.id === 'outcome' || v.id === 'trust') &&
    typeof v.label === 'string' &&
    typeof v.rationale === 'string' &&
    Array.isArray(v.variants) &&
    v.variants.length > 0
  );
}
