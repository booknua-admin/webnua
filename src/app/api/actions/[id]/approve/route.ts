// =============================================================================
// POST /api/actions/[id]/approve — approve a suggested action + dispatch its
// side effect.
//
// The approval-first spine's execution half. The owner taps Approve on a
// card; this route (1) verifies the caller can act on the action's client,
// (2) dispatches the underlying side effect by kind — reply drafts send via
// the existing /api/leads/[id]/reply route (self-fetch with the caller's own
// bearer token, so lead-access auth + the takeover/handoff machinery all run
// exactly as a manual reply would), ads actions go via the Meta campaigns
// route — then (3) flips the row to approved with the dispatch result.
//
// Body: { body?: string } — an optional edited version of the draft (the
// Edit-then-approve path). Kinds with no side effect (followup_nudge,
// generic, ads_creative_refresh) just mark approved — approval IS the
// acknowledgement.
// =============================================================================

import { NextResponse } from 'next/server';

import { findSuggestedAction, resolveSuggestedAction } from '@/lib/actions/server';
import type { AdsActionPayload, ReplyDraftPayload } from '@/lib/actions/types';
import { getAppBaseUrl } from '@/lib/env';
import { requireClientAccess } from '@/lib/integrations/_shared/operator-auth';

function baseUrl(request: Request): string {
  return getAppBaseUrl() || new URL(request.url).origin;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: 'missing-id' }, { status: 400 });

  const action = await findSuggestedAction(id);
  if (!action) return NextResponse.json({ error: 'not-found' }, { status: 404 });
  if (action.status !== 'pending') {
    return NextResponse.json({ error: 'already-resolved', status: action.status }, { status: 409 });
  }
  if (action.expires_at && new Date(action.expires_at).getTime() < Date.now()) {
    await resolveSuggestedAction(id, 'expired', null);
    return NextResponse.json({ error: 'expired' }, { status: 410 });
  }

  const auth = await requireClientAccess(request, action.client_id);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: { body?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // Empty body is fine — approve without edits.
  }
  const editedBody =
    typeof body.body === 'string' && body.body.trim() ? body.body.trim() : null;

  const authorization = request.headers.get('authorization') ?? '';

  try {
    let resolution: Record<string, unknown> = {};

    switch (action.kind) {
      case 'reply_draft': {
        const payload = action.payload as unknown as ReplyDraftPayload;
        if (!payload.leadId) {
          return NextResponse.json({ error: 'malformed-payload' }, { status: 422 });
        }
        const sendText = editedBody ?? payload.draftText;
        if (!sendText) {
          return NextResponse.json({ error: 'empty-draft' }, { status: 422 });
        }
        const response = await fetch(
          `${baseUrl(request)}/api/leads/${payload.leadId}/reply`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: authorization,
            },
            body: JSON.stringify({
              body: sendText,
              ...(payload.subject ? { subject: payload.subject } : {}),
            }),
          },
        );
        const result = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        if (!response.ok) {
          return NextResponse.json(
            { error: 'dispatch-failed', detail: result.error ?? response.status },
            { status: 502 },
          );
        }
        resolution = { sent: true, messageId: result.messageId ?? null, edited: !!editedBody };
        break;
      }

      case 'ads_pause':
      case 'ads_budget': {
        const payload = action.payload as unknown as AdsActionPayload;
        if (!payload.metaCampaignDbId) {
          return NextResponse.json({ error: 'malformed-payload' }, { status: 422 });
        }
        const requestBody: Record<string, unknown> =
          action.kind === 'ads_pause'
            ? {
                clientId: action.client_id,
                metaCampaignDbId: payload.metaCampaignDbId,
                action: 'pause',
              }
            : {
                clientId: action.client_id,
                metaCampaignDbId: payload.metaCampaignDbId,
                action: 'set_budget',
                dailyBudgetCents: payload.newDailyBudgetCents,
              };
        const response = await fetch(
          `${baseUrl(request)}/api/integrations/meta_ads/campaigns`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: authorization,
            },
            body: JSON.stringify(requestBody),
          },
        );
        const result = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        if (!response.ok) {
          return NextResponse.json(
            { error: 'dispatch-failed', detail: result.error ?? response.status },
            { status: 502 },
          );
        }
        resolution = { applied: true, ...result };
        break;
      }

      // Acknowledge-only kinds — no side effect to dispatch.
      case 'review_reply_draft':
      case 'ads_creative_refresh':
      case 'followup_nudge':
      case 'generic':
        resolution = { acknowledged: true };
        break;
    }

    await resolveSuggestedAction(id, 'approved', auth.userId, resolution);
    return NextResponse.json({ ok: true, resolution });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'dispatch-failed', detail: message }, { status: 500 });
  }
}
