// =============================================================================
// /api/integrations/meta_ads/ad-accounts
//
// The post-OAuth Meta picker surface — client-or-operator. The Meta ad
// account belongs to the customer, so they may pick it themselves OR the
// operator may pick on their behalf (mirrors GBP's locations route).
//
//   POST { clientId, action: 'list' }
//     Returns the ad accounts the connected Meta user can manage + the
//     Pages they own (lead-gen ads need a Page). One flat response so the
//     picker UI has everything it needs in one round trip.
//
//   POST { clientId, action: 'select', adAccountId, customerAgreementEmail }
//     Persists the chosen ad account into client_meta_ad_accounts. The
//     customerAgreementEmail field is the audit trail that the customer
//     agreed to (a) Meta billing their card directly for ad spend and
//     (b) Webnua managing campaigns on their behalf.
//
// Returns 503 when Meta is unconfigured (the OAuth callback would have
// fired but Meta env vars are absent). 502 is reserved for downstream
// Meta failures.
// =============================================================================

import { NextResponse } from 'next/server';

import {
  getAdAccount,
  isMetaConfigured,
  listAdAccounts,
  listPages,
} from '@/lib/integrations/meta-ads/client';
import {
  findAdAccountByClientId,
  upsertAdAccount,
} from '@/lib/integrations/meta-ads/ad-accounts';
import {
  describeMetaAccountStatus,
} from '@/lib/integrations/meta-ads/types';
import {
  shareAssetsWithWebnua,
  revokeAssetsFromWebnua,
} from '@/lib/integrations/meta-ads/share-assets';
import {
  META_SYNC_CAMPAIGNS_JOB,
  type MetaSyncCampaignsPayload,
} from '@/lib/integrations/meta-ads/job-types';
import { enqueueJobImmediate } from '@/lib/integrations/_shared/jobs';
import { requireClientAccess } from '@/lib/integrations/_shared/operator-auth';

export async function POST(request: Request): Promise<Response> {
  let body: { clientId?: unknown; action?: unknown; [k: string]: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  const clientId = body.clientId;
  if (typeof clientId !== 'string' || clientId.length === 0) {
    return NextResponse.json({ error: 'missing-clientId' }, { status: 400 });
  }

  const auth = await requireClientAccess(request, clientId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!isMetaConfigured()) {
    return NextResponse.json({ error: 'meta-not-configured' }, { status: 503 });
  }

  const action = body.action;
  if (action === 'list') {
    const [accounts, pages] = await Promise.all([
      listAdAccounts(clientId),
      listPages(clientId),
    ]);
    if (!accounts.ok) {
      return NextResponse.json(
        {
          error: 'meta-list-ad-accounts-failed',
          detail: accounts.error.message,
          class: accounts.error.class,
        },
        { status: 502 },
      );
    }
    return NextResponse.json({
      adAccounts: accounts.data.map((a) => ({
        id: a.id,
        accountId: a.account_id,
        name: a.name,
        currency: a.currency,
        statusCode: a.account_status,
        statusLabel: describeMetaAccountStatus(a.account_status),
        timezone: a.timezone_name,
        business: a.business,
        amountSpent: a.amount_spent,
        balance: a.balance,
      })),
      pages: pages.ok
        ? pages.data.map((p) => ({
            id: p.id,
            name: p.name,
            accessToken: p.access_token,
            tasks: p.tasks,
          }))
        : [],
      pagesError: pages.ok
        ? null
        : { detail: pages.error.message, class: pages.error.class },
    });
  }

  if (action === 'select') {
    const adAccountId = body.adAccountId;
    const customerAgreementEmail = body.customerAgreementEmail;
    const pageId = body.pageId;
    const pageName = body.pageName;
    if (typeof adAccountId !== 'string' || !adAccountId.startsWith('act_')) {
      return NextResponse.json({ error: 'invalid-adAccountId' }, { status: 400 });
    }
    if (
      typeof customerAgreementEmail !== 'string' ||
      !customerAgreementEmail.includes('@')
    ) {
      return NextResponse.json(
        { error: 'invalid-customerAgreementEmail' },
        { status: 400 },
      );
    }
    // pageId is optional in V1 — the customer may have no Page suitable
    // for lead-gen ads (rare but possible). When provided it must be a
    // non-empty string; we don't enforce a numeric shape because Meta
    // ids are large integers stored as strings.
    const safePageId =
      typeof pageId === 'string' && pageId.trim().length > 0 ? pageId.trim() : null;
    const safePageName =
      typeof pageName === 'string' && pageName.trim().length > 0 ? pageName.trim() : null;

    const detail = await getAdAccount(clientId, adAccountId);
    if (!detail.ok) {
      return NextResponse.json(
        {
          error: 'meta-get-ad-account-failed',
          detail: detail.error.message,
          class: detail.error.class,
        },
        { status: 502 },
      );
    }
    const acct = detail.data;
    try {
      await upsertAdAccount({
        client_id: clientId,
        meta_ad_account_id: acct.id ?? adAccountId,
        meta_business_id: acct.business?.id ?? null,
        meta_user_id: null,
        ad_account_name: acct.name ?? null,
        currency: acct.currency ?? null,
        account_status: acct.account_status ?? null,
        amount_spent_cents:
          typeof acct.amount_spent === 'string'
            ? parseInt(acct.amount_spent, 10) || null
            : null,
        balance_cents:
          typeof acct.balance === 'string' ? parseInt(acct.balance, 10) || null : null,
        timezone_name: acct.timezone_name ?? null,
        customer_agreed_at: new Date().toISOString(),
        customer_agreed_by_email: customerAgreementEmail,
        last_synced_at: new Date().toISOString(),
        meta_page_id: safePageId,
        meta_page_name: safePageName,
        webnua_partner_status: 'pending',
        webnua_partner_granted_at: null,
        webnua_partner_error: null,
        webnua_page_partner_status: safePageId ? 'pending' : null,
        webnua_page_partner_granted_at: null,
        webnua_page_partner_error: null,
      });
    } catch (err) {
      return NextResponse.json(
        {
          error: 'select-write-failed',
          detail: err instanceof Error ? err.message : 'write failed',
        },
        { status: 500 },
      );
    }

    // Share the customer's assets with Webnua's Business Manager so
    // operators see them natively in their own Ads Manager. The
    // orchestrator writes the partner-status columns and never throws on
    // a Meta failure — the picker confirmation step shows the per-asset
    // outcome and the footer's retry affordance handles the recovery
    // path. Returning the result inline lets the modal show success/
    // partial-success without a second round trip.
    const partnerResult = await shareAssetsWithWebnua({
      clientId,
      adAccountId: acct.id ?? adAccountId,
      pageId: safePageId,
    });

    // Kick off campaign discovery so the operator sees their Ads-Manager-
    // launched campaigns appear on /campaigns within seconds. Fire-and-
    // forget — a failed enqueue must not fail the picker save (the hourly
    // cron will catch it on the next tick).
    try {
      const campaignsPayload: MetaSyncCampaignsPayload = { clientId };
      await enqueueJobImmediate(META_SYNC_CAMPAIGNS_JOB, campaignsPayload, {
        clientId,
        provider: 'meta_ads',
        correlationId: clientId,
      });
    } catch (err) {
      console.warn(
        '[meta_ads/ad-accounts] post-select campaign sync enqueue failed:',
        err instanceof Error ? err.message : err,
      );
    }
    return NextResponse.json({ ok: true, partner: partnerResult });
  }

  if (action === 'share-retry') {
    // Operator retries the partner share when it failed on first
    // attempt — typically because META_WEBNUA_BUSINESS_ID was unset at
    // pick time, or a transient Meta API blip. Reads the persisted row
    // for ad-account + page ids; refuses cleanly if there's no row.
    const row = await findAdAccountByClientId(clientId);
    if (!row) {
      return NextResponse.json({ error: 'no-ad-account-selected' }, { status: 400 });
    }
    const partnerResult = await shareAssetsWithWebnua({
      clientId,
      adAccountId: row.meta_ad_account_id,
      pageId: row.meta_page_id,
    });
    return NextResponse.json({ ok: true, partner: partnerResult });
  }

  if (action === 'share-revoke') {
    // Operator-initiated revoke of Webnua's partner access without
    // disconnecting the OAuth connection. Useful when the customer asks
    // Webnua to step back but wants to keep their data intact. Reads
    // the persisted row; idempotent (Meta-side errors are absorbed).
    const row = await findAdAccountByClientId(clientId);
    if (!row) {
      return NextResponse.json({ error: 'no-ad-account-selected' }, { status: 400 });
    }
    await revokeAssetsFromWebnua({
      clientId,
      adAccountId: row.meta_ad_account_id,
      pageId: row.meta_page_id,
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'unknown-action' }, { status: 400 });
}
