'use client';

// =============================================================================
// DomainStatusCard — one attached domain, with status + DNS + actions.
//
// Phase 9 custom-domain attachment. Reused by client + operator UIs (same
// component — operator-only actions are gated at the API layer, not in the
// UI). Auto-refreshes the row every 30 seconds while the status is in-flight
// so a customer watching the page sees the transition without manually
// clicking "Check now".
// =============================================================================

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import {
  useCheckDomain,
  useRemoveDomain,
  useSetPrimaryDomain,
} from '@/lib/domains/queries';
import {
  IN_FLIGHT_STATUSES,
  STATUS_DESCRIPTION,
  STATUS_LABEL,
  type CustomDomainRow,
} from '@/lib/domains/types';

import { DnsRecordsTable } from './DnsRecordsTable';

const STATUS_DOT: Record<string, string> = {
  pending_dns: 'bg-warn',
  verifying: 'bg-warn animate-pulse',
  ssl_pending: 'bg-info animate-pulse',
  live: 'bg-good',
  failed: 'bg-warn',
  removed: 'bg-rule',
};

function formatRelative(iso: string | null): string {
  if (!iso) return 'never';
  const delta = Date.now() - new Date(iso).getTime();
  if (delta < 0) return 'in the future';
  const minutes = Math.round(delta / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function DomainStatusCard({
  domain,
  conciergeCalendarUrl,
}: {
  domain: CustomDomainRow;
  conciergeCalendarUrl: string | null;
}) {
  const check = useCheckDomain();
  const setPrimary = useSetPrimaryDomain();
  const remove = useRemoveDomain();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const inFlight = IN_FLIGHT_STATUSES.includes(domain.status);

  // Auto-refresh every 30 seconds while in-flight. The mutation hook
  // invalidates the list query, so the parent's useClientDomains re-runs and
  // this row gets fresh props.
  useEffect(() => {
    if (!inFlight) return;
    const handle = window.setInterval(() => {
      check.mutate({ domainId: domain.id });
    }, 30_000);
    return () => window.clearInterval(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inFlight, domain.id]);

  const onConfirmRemove = async () => {
    setRemoveError(null);
    try {
      await remove.mutateAsync({ domainId: domain.id, clientId: domain.client_id });
      setConfirmRemove(false);
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : 'Could not remove the domain.');
    }
  };

  return (
    <article className="rounded-xl border border-rule bg-card px-5 py-5 shadow-card">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[domain.status] ?? 'bg-rule'}`}
            />
            <h3 className="font-mono text-[14px] font-bold tracking-tight text-ink">
              {domain.domain}
            </h3>
            {domain.is_primary ? (
              <span className="rounded-full bg-rust/12 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
                Primary
              </span>
            ) : null}
            {domain.status === 'live' ? (
              <a
                href={`https://${domain.domain}`}
                target="_blank"
                rel="noreferrer noopener"
                className="ml-1 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-rust hover:text-rust-deep"
              >
                Open ↗
              </a>
            ) : null}
          </div>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
            {STATUS_LABEL[domain.status]}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {inFlight ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={check.isPending}
              onClick={() => check.mutate({ domainId: domain.id })}
            >
              {check.isPending ? 'Checking…' : 'Check now'}
            </Button>
          ) : null}
          {domain.status === 'live' && !domain.is_primary ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={setPrimary.isPending}
              onClick={() => setPrimary.mutate({ domainId: domain.id })}
            >
              Set as primary
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setRemoveError(null);
              setConfirmRemove(true);
            }}
          >
            Remove
          </Button>
        </div>
      </header>

      <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
        {STATUS_DESCRIPTION[domain.status]}
      </p>

      {domain.status === 'failed' && domain.verification_failed_reason ? (
        <p className="mt-2 rounded-md border border-warn/30 bg-warn/8 px-3 py-2 font-mono text-[12px] text-warn">
          {domain.verification_failed_reason}
        </p>
      ) : null}

      {inFlight ? (
        <div className="mt-5 flex flex-col gap-3">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
            {'// DNS records to set at your domain provider'}
          </p>
          <DnsRecordsTable records={domain.dns_records_required} />
          {conciergeCalendarUrl ? (
            <p className="text-[12px] text-ink-quiet">
              Need help setting this up?{' '}
              <a
                href={conciergeCalendarUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="font-bold text-rust hover:text-rust-deep"
              >
                Book a setup call →
              </a>
            </p>
          ) : null}
          {domain.last_checked_at ? (
            <p className="font-mono text-[11px] text-ink-quiet">
              Last checked {formatRelative(domain.last_checked_at)}
            </p>
          ) : null}
        </div>
      ) : null}

      {domain.status === 'live' ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-ink-quiet">
          <span>SSL · Active</span>
          {domain.verified_at ? (
            <span>Verified {formatRelative(domain.verified_at)}</span>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title="Remove this domain?"
        description={
          domain.is_primary
            ? 'This is your primary domain. Removing it points visitors back to your Webnua subdomain.'
            : 'Visitors trying to reach this domain will no longer find your site.'
        }
        confirmLabel="Remove"
        cancelLabel="Cancel"
        tone="destructive"
        onConfirm={onConfirmRemove}
      />
      {removeError ? (
        <p className="mt-2 font-mono text-[11px] text-warn">{removeError}</p>
      ) : null}
    </article>
  );
}
