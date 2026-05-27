'use client';

// =============================================================================
// MetaAdAccountFooter — the in-row summary block below the Meta connection
// row on sub-account /settings/integrations.
//
// Phase 7 Meta Ads. Mirror of GbpConnectionFooter — the operational layer
// (which ad account, current balance, currency, status) lives co-located
// with the connection itself instead of on a separate tab.
//
// States:
//   • Loading      → render nothing (parent row still shows the connection meta)
//   • Connected, no ad-account assignment yet
//                  → prompt to pick + open the picker modal
//   • Connected + assigned
//                  → show ad-account name + balance + status + Change ad account
//                    + Webnua-BM partner-share status with retry / revoke
//                    affordances when applicable (migration 0113).
// =============================================================================

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  useClientMetaAdAccount,
  useRetryMetaPartnerShare,
  useRevokeMetaPartnerShare,
} from '@/lib/integrations/meta-ads/use-meta-ads';
import {
  describeMetaAccountStatus,
  type ClientMetaAdAccountRow,
} from '@/lib/integrations/meta-ads/types';

import { MetaAdAccountPickerModal } from './MetaAdAccountPickerModal';

function formatMinor(cents: number | null, currency: string | null): string {
  if (cents == null) return '—';
  try {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: currency ?? 'EUR',
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(0)} ${currency ?? ''}`.trim();
  }
}

export function MetaAdAccountFooter({ clientId }: { clientId: string }) {
  const account = useClientMetaAdAccount(clientId);
  const [pickerOpen, setPickerOpen] = useState(false);

  if (account.isLoading) return null;

  const row = account.data ?? null;
  if (!row) {
    return (
      <div className="mt-2 rounded-md border border-dashed border-rule bg-paper/70 px-3 py-2">
        <div className="text-[12px] leading-[1.5] text-ink-quiet">
          <strong className="text-ink">Pick an ad account</strong> — the
          OAuth connect is live but Webnua doesn&apos;t know which of this
          customer&apos;s ad accounts to manage.
        </div>
        <div className="mt-2">
          <Button size="sm" onClick={() => setPickerOpen(true)}>
            Choose ad account
          </Button>
        </div>
        <MetaAdAccountPickerModal
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          clientId={clientId}
        />
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-md border border-rule bg-paper/70 px-3 py-2">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <div className="min-w-0">
          <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-quiet">
            Ad account
          </div>
          <div className="text-[13px] font-bold text-ink">
            {row.ad_account_name ?? row.meta_ad_account_id}
          </div>
        </div>
        <div className="min-w-0">
          <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-quiet">
            Currency · status
          </div>
          <div className="text-[12px] text-ink-soft">
            {row.currency ?? '—'} ·{' '}
            <span
              className={
                row.account_status === 1
                  ? 'text-good'
                  : row.account_status == null
                  ? 'text-ink-quiet'
                  : 'text-warn'
              }
            >
              {describeMetaAccountStatus(row.account_status)}
            </span>
          </div>
        </div>
        <div className="min-w-0">
          <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-quiet">
            Balance · spend
          </div>
          <div className="text-[12px] text-ink-soft">
            {formatMinor(row.balance_cents, row.currency)} · spent{' '}
            {formatMinor(row.amount_spent_cents, row.currency)}
          </div>
        </div>
        {row.meta_page_name || row.meta_page_id ? (
          <div className="min-w-0">
            <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-quiet">
              Page
            </div>
            <div className="text-[12px] text-ink-soft">
              {row.meta_page_name ?? row.meta_page_id}
            </div>
          </div>
        ) : null}
      </div>

      <PartnerStatusBlock row={row} clientId={clientId} />

      <div className="mt-2 flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
          Change ad account
        </Button>
      </div>
      <MetaAdAccountPickerModal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        clientId={clientId}
      />
    </div>
  );
}

/** Webnua-BM partner-share status row + retry/revoke affordances.
 *  Renders nothing for legacy pre-0113 rows where both status columns
 *  are null (e.g. a connection picked before this feature shipped — the
 *  operator can retry from here without re-picking the ad account). */
function PartnerStatusBlock({
  row,
  clientId,
}: {
  row: ClientMetaAdAccountRow;
  clientId: string;
}) {
  const retry = useRetryMetaPartnerShare();
  const revoke = useRevokeMetaPartnerShare();

  const adStatus = row.webnua_partner_status;
  const pageStatus = row.webnua_page_partner_status;

  // Pre-0113 row with no partner info at all — surface a "Grant access"
  // prompt so the operator can run the share without re-picking.
  if (adStatus == null && pageStatus == null) {
    return (
      <div className="mt-2 rounded-md border border-dashed border-rule bg-paper px-3 py-2">
        <div className="text-[12px] text-ink-quiet">
          <strong className="text-ink">Webnua partner access:</strong> not
          granted. Add Webnua&apos;s Business Manager as a partner so your
          team sees this account in their own Meta Ads Manager.
        </div>
        <div className="mt-2">
          <Button
            size="sm"
            onClick={() => retry.mutate({ clientId })}
            disabled={retry.isPending}
          >
            {retry.isPending ? 'Granting access…' : 'Grant Webnua access'}
          </Button>
        </div>
      </div>
    );
  }

  const allActive =
    adStatus === 'active' &&
    (pageStatus === 'active' || pageStatus == null);
  const anyFailed = adStatus === 'failed' || pageStatus === 'failed';
  const allRevoked =
    adStatus === 'revoked' &&
    (pageStatus === 'revoked' || pageStatus == null);

  return (
    <div
      className={
        allActive
          ? 'mt-2 rounded-md border border-good bg-good-soft px-3 py-2'
          : anyFailed
          ? 'mt-2 rounded-md border border-warn bg-warn-soft px-3 py-2'
          : 'mt-2 rounded-md border border-rule bg-paper px-3 py-2'
      }
    >
      <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-quiet">
        Webnua partner access
      </div>
      <div className="mt-1 grid gap-1 text-[12px] leading-[1.45]">
        <PartnerLine
          label="Ad account"
          status={adStatus}
          error={row.webnua_partner_error}
        />
        {row.meta_page_id ? (
          <PartnerLine
            label="Page"
            status={pageStatus}
            error={row.webnua_page_partner_error}
          />
        ) : null}
      </div>

      {anyFailed ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => retry.mutate({ clientId })}
            disabled={retry.isPending}
          >
            {retry.isPending ? 'Retrying…' : 'Retry partner access'}
          </Button>
        </div>
      ) : allActive ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => revoke.mutate({ clientId })}
            disabled={revoke.isPending}
          >
            {revoke.isPending ? 'Revoking…' : 'Revoke partner access'}
          </Button>
        </div>
      ) : allRevoked ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => retry.mutate({ clientId })}
            disabled={retry.isPending}
          >
            {retry.isPending ? 'Granting access…' : 'Grant Webnua access'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function PartnerLine({
  label,
  status,
  error,
}: {
  label: string;
  status: ClientMetaAdAccountRow['webnua_partner_status'];
  error: string | null;
}) {
  const toneClass =
    status === 'active'
      ? 'text-good'
      : status === 'failed'
      ? 'text-warn'
      : 'text-ink-quiet';
  const label2 =
    status === 'active'
      ? 'Active'
      : status === 'pending'
      ? 'Pending…'
      : status === 'failed'
      ? 'Failed'
      : status === 'revoked'
      ? 'Revoked'
      : 'Not granted';
  return (
    <div className="flex items-baseline gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-quiet">
        {label}
      </span>
      <span className={`font-bold ${toneClass}`}>{label2}</span>
      {error && status === 'failed' ? (
        <span className="text-[11px] text-warn">· {error}</span>
      ) : null}
    </div>
  );
}
