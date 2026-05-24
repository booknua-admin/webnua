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
// =============================================================================

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  useClientMetaAdAccount,
} from '@/lib/integrations/meta-ads/use-meta-ads';
import { describeMetaAccountStatus } from '@/lib/integrations/meta-ads/types';

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
      </div>
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
