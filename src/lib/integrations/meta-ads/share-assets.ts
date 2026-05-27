// =============================================================================
// Meta Ads — Business Asset Sharing orchestrator.
//
// Phase 7 Meta Ads · migration 0113. Runs immediately after the customer
// picks their ad account + Page in MetaAdAccountPickerModal. Calls Meta's
// asset-sharing endpoints (POST /act_<id>/agencies + POST /<page_id>/
// agencies) so Webnua's Business Manager becomes a partner on the
// customer's assets.
//
// Why this exists: OAuth alone grants the APP permission to call APIs on
// the customer's behalf; it does NOT make Webnua's Business Manager a
// partner on their ad account. Without partner access, an operator
// opening their own Ads Manager would see only their own accounts.
// With partner access, the customer's ad account + Page show up in
// every Webnua operator's BM natively — the standard agency shape.
//
// Partial-success handling: ad account and Page shares are independent
// API calls. Either may succeed/fail without the other. The function
// always writes BOTH status columns (one per asset) and returns the
// per-asset outcome so the caller can surface the right UI state. We
// never throw on a Meta-side failure here — the share is a "best effort"
// step on top of the already-confirmed account selection; the operator
// retries from the footer if it fails.
//
// SERVER-ONLY — reads env.META_WEBNUA_BUSINESS_ID + uses callWithToken.
// =============================================================================

import { env } from '@/lib/env';

import {
  shareAdAccountWithWebnua,
  sharePageWithWebnua,
  revokeAdAccountFromWebnua,
  revokePageFromWebnua,
} from './client';
import { updatePartnerStatus } from './ad-accounts';
import type { MetaPartnerStatus } from './types';

export type ShareOutcome =
  | { kind: 'active' }
  | { kind: 'skipped'; reason: string }
  | { kind: 'failed'; reason: string };

export type ShareAssetsResult = {
  adAccount: ShareOutcome;
  page: ShareOutcome;
};

/** Share the customer's ad account (and Page, when known) with Webnua's
 *  Business Manager. Always writes the partner-status columns and
 *  returns the per-asset outcome — never throws on a Meta failure. The
 *  caller surfaces the result in the picker confirmation step + the
 *  footer's partner-status indicator. */
export async function shareAssetsWithWebnua(input: {
  clientId: string;
  adAccountId: string;
  pageId: string | null;
}): Promise<ShareAssetsResult> {
  const { clientId, adAccountId, pageId } = input;
  const webnuaBusinessId = env.META_WEBNUA_BUSINESS_ID;

  // Without our own BM id we cannot ask Meta to add us as a partner.
  // This is operator-misconfiguration territory, not a degraded path —
  // the customer doesn't see a half-state, the operator sees a clear
  // status that prompts them to set the env var.
  if (!webnuaBusinessId) {
    const reason = 'META_WEBNUA_BUSINESS_ID is not configured';
    await updatePartnerStatus(clientId, {
      webnua_partner_status: 'failed',
      webnua_partner_granted_at: null,
      webnua_partner_error: reason,
      webnua_page_partner_status: pageId ? 'failed' : null,
      webnua_page_partner_granted_at: null,
      webnua_page_partner_error: pageId ? reason : null,
    });
    return {
      adAccount: { kind: 'failed', reason },
      page: pageId
        ? { kind: 'failed', reason }
        : { kind: 'skipped', reason: 'no Page selected' },
    };
  }

  // Run both shares in parallel — they are independent API calls and
  // serialising them buys nothing. Each is wrapped so a thrown error
  // (from callWithToken's auth flow, network blip) is captured rather
  // than aborting the partner status of the other half.
  const [adResult, pageResult] = await Promise.allSettled([
    shareAdAccountWithWebnua(clientId, adAccountId, webnuaBusinessId),
    pageId ? sharePageWithWebnua(clientId, pageId, webnuaBusinessId) : Promise.resolve(null),
  ]);

  const adAccount = interpretResult(adResult, 'ad account');
  const page = pageId
    ? interpretResult(pageResult, 'Page')
    : ({ kind: 'skipped', reason: 'no Page selected' } as const);

  // Single DB write covers both halves so the row is consistent.
  await updatePartnerStatus(clientId, {
    webnua_partner_status: toStatusColumn(adAccount),
    webnua_partner_granted_at: adAccount.kind === 'active' ? new Date().toISOString() : null,
    webnua_partner_error: adAccount.kind === 'failed' ? adAccount.reason : null,
    webnua_page_partner_status: pageId ? toStatusColumn(page) : null,
    webnua_page_partner_granted_at:
      page.kind === 'active' ? new Date().toISOString() : null,
    webnua_page_partner_error: page.kind === 'failed' ? page.reason : null,
  });

  return { adAccount, page };
}

/** Revoke Webnua's partner access on disconnect. Best-effort — Meta-side
 *  failures (e.g. the share was already revoked by the customer from
 *  their own BM) are absorbed and the DB columns flip to 'revoked'
 *  regardless. The caller (the disconnect flow) should not block on a
 *  Meta error here. */
export async function revokeAssetsFromWebnua(input: {
  clientId: string;
  adAccountId: string;
  pageId: string | null;
}): Promise<void> {
  const { clientId, adAccountId, pageId } = input;
  const webnuaBusinessId = env.META_WEBNUA_BUSINESS_ID;

  if (webnuaBusinessId) {
    await Promise.allSettled([
      revokeAdAccountFromWebnua(clientId, adAccountId, webnuaBusinessId),
      pageId
        ? revokePageFromWebnua(clientId, pageId, webnuaBusinessId)
        : Promise.resolve(null),
    ]);
  }

  await updatePartnerStatus(clientId, {
    webnua_partner_status: 'revoked',
    webnua_partner_error: null,
    webnua_page_partner_status: pageId ? 'revoked' : null,
    webnua_page_partner_error: null,
  });
}

function interpretResult(
  settled: PromiseSettledResult<{ ok: boolean; error?: { message?: string } } | null>,
  label: string,
): ShareOutcome {
  if (settled.status === 'rejected') {
    return {
      kind: 'failed',
      reason: errorMessage(settled.reason, `${label} share threw`),
    };
  }
  const value = settled.value;
  if (!value) return { kind: 'skipped', reason: `no ${label} selected` };
  if (value.ok) return { kind: 'active' };
  return {
    kind: 'failed',
    reason: value.error?.message ?? `${label} share returned an unknown error`,
  };
}

function toStatusColumn(outcome: ShareOutcome): MetaPartnerStatus | null {
  switch (outcome.kind) {
    case 'active':
      return 'active';
    case 'failed':
      return 'failed';
    case 'skipped':
      return null;
  }
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return fallback;
}
