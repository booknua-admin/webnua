// =============================================================================
// Browser-side caller for /api/integrations/meta_ads/propose-brief-fills.
//
// Phase 7.5 · Session 2.2. The Generate surface calls this when
// the brief has soft-block gaps; the route returns proposed values for
// each missing field + a rationale. The UI renders the proposals as
// editable cards the operator confirms in one pass.
// =============================================================================

import { AppError } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';
import type { BriefField } from '@/lib/campaigns/brief-completeness';

export type BriefFillProposal = {
  field: BriefField;
  proposed: string;
  rationale: string;
};

async function accessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw AppError.auth('You are signed out — sign in again.');
  return token;
}

export async function proposeBriefFills(
  clientId: string,
  missing: readonly BriefField[],
): Promise<BriefFillProposal[]> {
  if (missing.length === 0) return [];
  const token = await accessToken();
  const response = await fetch(
    '/api/integrations/meta_ads/propose-brief-fills',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ clientId, missing }),
    },
  );
  if (response.status === 503) {
    throw AppError.unexpected(
      undefined,
      'Webnua AI is not configured on this deployment. Ask your operator to set ANTHROPIC_API_KEY.',
    );
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
        : 'Daily limit for ad generation reached — try again tomorrow.';
    throw AppError.unexpected(undefined, detail);
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
      `Brief-fill failed (${response.status}).`;
    throw AppError.unexpected(undefined, detail);
  }
  const json = (await response.json()) as { proposals?: unknown };
  const raw = Array.isArray(json.proposals) ? json.proposals : [];
  return raw.filter(isProposal);
}

function isProposal(value: unknown): value is BriefFillProposal {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  const validFields: readonly BriefField[] = [
    'offer',
    'audience_line',
    'services',
    'accent_color',
  ];
  return (
    validFields.includes(v.field as BriefField) &&
    typeof v.proposed === 'string' &&
    typeof v.rationale === 'string'
  );
}
