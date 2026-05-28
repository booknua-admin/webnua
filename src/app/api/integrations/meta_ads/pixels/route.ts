// =============================================================================
// /api/integrations/meta_ads/pixels
//
// Phase 7.5 · Session 1.2. Operator-only Meta Pixel discovery + selection
// for the launch wizard's landing-page objective path.
//
// Two actions:
//   • { clientId, action: 'list' }
//       Returns the Pixels reachable from the customer's connected ad
//       account, excluding `is_unavailable` rows. Auto-selection is the
//       wizard's responsibility (single pixel → preselected; multiple →
//       dropdown; zero → block with "Set up a Pixel first").
//
//   • { clientId, action: 'select', pixelId }
//       Persists the operator-confirmed pixel id on
//       `client_meta_ad_accounts.meta_pixel_id`. Idempotent — re-running
//       overwrites. The launch orchestrator + the PublicSiteRenderer
//       both read from this column.
//
// Auth: requireOperatorForClient — pixel selection is campaign-builder
// governance, same shape as the launch + draft routes.
//
// Responses:
//   200 → { pixels: Array<{ id, name, lastFiredAt?: string | null }> } (list)
//         { ok: true } (select)
//   400 → { error: 'invalid-body' | 'missing-<field>' | 'unknown-action' }
//   403 → { error: 'forbidden' | 'forbidden-client' }
//   404 → { error: 'no-ad-account' }
//   503 → { error: 'meta-not-configured' }
//   502 → { error: 'list-pixels-failed' | 'select-write-failed', detail }
// =============================================================================

import { NextResponse } from 'next/server';

import { isMetaConfigured, listAdsPixels } from '@/lib/integrations/meta-ads/client';
import { requireOperatorForClient } from '@/lib/integrations/_shared/operator-auth';
import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';

export const maxDuration = 15;

export async function POST(request: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  const clientId = body.clientId;
  if (typeof clientId !== 'string' || clientId.length === 0) {
    return NextResponse.json({ error: 'missing-clientId' }, { status: 400 });
  }
  const auth = await requireOperatorForClient(request, clientId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!isMetaConfigured()) {
    return NextResponse.json({ error: 'meta-not-configured' }, { status: 503 });
  }

  const db = getIntegrationDb();
  const { data: adAccountRow, error: rowErr } = await db
    .from('client_meta_ad_accounts')
    .select('meta_ad_account_id')
    .eq('client_id', clientId)
    .maybeSingle();
  if (rowErr || !adAccountRow) {
    return NextResponse.json({ error: 'no-ad-account' }, { status: 404 });
  }
  const adAccountId = (adAccountRow as { meta_ad_account_id: string }).meta_ad_account_id;

  const action = body.action;
  if (action === 'list') {
    const result = await listAdsPixels(clientId, adAccountId);
    if (!result.ok) {
      return NextResponse.json(
        { error: 'list-pixels-failed', detail: result.error.message },
        { status: 502 },
      );
    }
    const pixels = result.data
      .filter((p) => p.id && p.name && !p.is_unavailable)
      .map((p) => ({
        id: p.id as string,
        name: p.name as string,
        lastFiredAt: p.last_fired_time ?? null,
      }));
    return NextResponse.json({ pixels });
  }

  if (action === 'select') {
    const pixelId = body.pixelId;
    if (typeof pixelId !== 'string' || pixelId.length === 0) {
      return NextResponse.json({ error: 'missing-pixelId' }, { status: 400 });
    }
    const { error: updateErr } = await db
      .from('client_meta_ad_accounts')
      .update({ meta_pixel_id: pixelId } as unknown as never)
      .eq('client_id', clientId);
    if (updateErr) {
      return NextResponse.json(
        { error: 'select-write-failed', detail: updateErr.message },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'unknown-action' }, { status: 400 });
}
