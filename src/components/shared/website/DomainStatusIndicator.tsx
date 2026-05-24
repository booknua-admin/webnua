'use client';

// =============================================================================
// DomainStatusIndicator — Phase 9-aware status pill for a website's domain.
//
// Originally a Cluster 5 · Session 8 stub that read a static
// `websites.domain_ssl_status` column. Phase 9 added the
// `client_custom_domains` table with real Vercel-backed status reconciliation
// (every 5 min + manual + 30s auto-refresh while in-flight) — when a clientId
// is passed, this component reads the primary live row from that table
// instead of the legacy column.
//
// Resolution order:
//   1. If `clientId` is provided AND a `client_custom_domains` row exists for
//      that client, the primary row wins (status sourced from its `status`
//      enum, NOT the legacy `domain.sslStatus`).
//   2. Otherwise the legacy `WebsiteDomain` prop is used (covers the
//      pre-Phase-9 single-domain flow + back-compat).
//
// Status → label mapping mirrors the new lifecycle (pending_dns / verifying
// / ssl_pending → "SSL provisioning" / "Verifying" etc.) so the UI stays
// honest about which step Vercel is on.
// =============================================================================

import type { CustomDomainRow, CustomDomainStatus } from '@/lib/domains/types';
import { useClientDomains } from '@/lib/domains/queries';
import type { WebsiteDomain } from '@/lib/website/types';

type SslPresentation = { dot: string; label: string; tone: string };

const LEGACY_SSL_META: Record<WebsiteDomain['sslStatus'], SslPresentation> = {
  live: { dot: 'bg-good', label: '🔒 Secure · SSL live', tone: 'text-good' },
  pending: { dot: 'bg-warn animate-pulse', label: 'SSL provisioning', tone: 'text-warn' },
  error: { dot: 'bg-warn', label: 'SSL error · needs attention', tone: 'text-warn' },
};

const PHASE9_SSL_META: Record<CustomDomainStatus, SslPresentation> = {
  pending_dns: { dot: 'bg-warn animate-pulse', label: 'Awaiting DNS', tone: 'text-warn' },
  verifying: { dot: 'bg-warn animate-pulse', label: 'Verifying DNS', tone: 'text-warn' },
  ssl_pending: { dot: 'bg-info animate-pulse', label: 'SSL provisioning', tone: 'text-info' },
  // Padlock prefix only when live — the customer's "this is real" signal.
  live: { dot: 'bg-good', label: '🔒 Secure · SSL live', tone: 'text-good' },
  failed: { dot: 'bg-warn', label: 'Failed · needs attention', tone: 'text-warn' },
  removed: { dot: 'bg-rule', label: 'Removed', tone: 'text-ink-quiet' },
};

export type DomainStatusIndicatorProps = {
  domain: WebsiteDomain;
  /** When provided, primary `client_custom_domains` row wins over `domain`. */
  clientId?: string | null;
  className?: string;
};

/** Pick the primary (or first) live custom-domain row for a client. */
function pickPrimary(rows: CustomDomainRow[] | undefined): CustomDomainRow | null {
  if (!rows || rows.length === 0) return null;
  const primary = rows.find((r) => r.is_primary);
  if (primary) return primary;
  // No primary set yet — return the first non-removed row (the picker UI
  // would show all of them, but the indicator surfaces the lead one).
  return rows[0] ?? null;
}

export function DomainStatusIndicator({
  domain,
  clientId,
  className,
}: DomainStatusIndicatorProps) {
  const { data: rows } = useClientDomains(clientId ?? null);
  const live = pickPrimary(rows);

  const display = live
    ? {
        primary: live.domain,
        meta: PHASE9_SSL_META[live.status],
        aliasCount: (rows?.filter((r) => r.id !== live.id).length ?? 0),
      }
    : {
        primary: domain.primary,
        meta: LEGACY_SSL_META[domain.sslStatus],
        aliasCount: domain.aliases.length,
      };

  return (
    <div
      data-slot="domain-status-indicator"
      className={`inline-flex items-center gap-2 rounded-lg border border-rule bg-card px-3 py-2 ${className ?? ''}`}
    >
      <span aria-hidden className={`size-2 rounded-full ${display.meta.dot}`} />
      <span className="font-mono text-[11px] font-bold tracking-[0.04em] text-ink">
        {display.primary || 'No custom domain'}
      </span>
      <span className="text-rule">·</span>
      <span
        className={`font-mono text-[10px] font-bold uppercase tracking-[0.1em] ${display.meta.tone}`}
      >
        {display.meta.label}
      </span>
      {display.aliasCount > 0 ? (
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
          + {display.aliasCount} {display.aliasCount === 1 ? 'alias' : 'aliases'}
        </span>
      ) : null}
    </div>
  );
}
