'use client';

// =============================================================================
// AllDomainsTable — operator cross-client domain roster.
//
// Phase 9. Mounted on the agency-mode /settings/domains tab. Shows every
// attached domain across every accessible client, with filters (status /
// client) + highlights for failed-or-stuck rows.
//
// Drilling into a row routes to the client's domain settings: clicking the
// client cell sets active client + navigates to /settings/domains; clicking
// the domain cell opens the live host in a new tab.
// =============================================================================

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { getClientSlugByUuid, useAdminClients } from '@/lib/clients/clients-store';
import { useAllDomains } from '@/lib/domains/queries';
import {
  STATUS_LABEL,
  type CustomDomainRow,
  type CustomDomainStatus,
} from '@/lib/domains/types';
import { useWorkspace } from '@/lib/workspace/workspace-stub';

type StatusFilter = 'all' | 'live' | 'in_flight' | 'failed';

const STATUS_DOT_CLASS: Record<CustomDomainStatus, string> = {
  pending_dns: 'bg-warn',
  verifying: 'bg-warn animate-pulse',
  ssl_pending: 'bg-info animate-pulse',
  live: 'bg-good',
  failed: 'bg-warn',
  removed: 'bg-rule',
};

function ageHours(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}

function formatAge(iso: string): string {
  const h = ageHours(iso);
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m ago`;
  if (h < 24) return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function statusMatchesFilter(s: CustomDomainStatus, f: StatusFilter): boolean {
  if (f === 'all') return true;
  if (f === 'live') return s === 'live';
  if (f === 'in_flight') return s === 'pending_dns' || s === 'verifying' || s === 'ssl_pending';
  if (f === 'failed') return s === 'failed';
  return true;
}

export function AllDomainsTable() {
  const router = useRouter();
  const { setActiveClientId } = useWorkspace();
  const { data: rows, isLoading } = useAllDomains();
  const clients = useAdminClients();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');

  const clientLookup = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const c of clients) {
      map.set(c.id, { id: c.id, name: c.name });
    }
    return map;
  }, [clients]);

  const filtered = useMemo(() => {
    const list = rows ?? [];
    return list.filter(
      (r) =>
        statusMatchesFilter(r.status, statusFilter) &&
        (clientFilter === 'all' || r.client_id === clientFilter),
    );
  }, [rows, statusFilter, clientFilter]);

  const counts = useMemo(() => {
    const list = rows ?? [];
    return {
      total: list.length,
      live: list.filter((r) => r.status === 'live').length,
      inFlight: list.filter(
        (r) => r.status === 'pending_dns' || r.status === 'verifying' || r.status === 'ssl_pending',
      ).length,
      failed: list.filter((r) => r.status === 'failed').length,
    };
  }, [rows]);

  const drillIn = (row: CustomDomainRow) => {
    // The workspace stub stores client SLUGS (AdminClient.id = slug per
    // clients-store.ts:55), not UUIDs. Resolve UUID → slug before storing.
    const slug = getClientSlugByUuid(row.client_id);
    if (!slug) return;
    setActiveClientId(slug);
    router.push('/settings/domains');
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Filter strip */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-rule bg-card px-5 py-4">
        <FilterChipGroup
          label="// Status"
          value={statusFilter}
          options={[
            { value: 'all', label: `All · ${counts.total}` },
            { value: 'live', label: `Live · ${counts.live}` },
            { value: 'in_flight', label: `In progress · ${counts.inFlight}` },
            { value: 'failed', label: `Failed · ${counts.failed}` },
          ]}
          onChange={(v) => setStatusFilter(v as StatusFilter)}
        />
        <div className="ml-auto flex items-center gap-2">
          <label className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
            {'// Client'}
          </label>
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="rounded-md border border-rule bg-card px-2 py-1 font-mono text-[12px] text-ink"
          >
            <option value="all">All clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Rows */}
      <div className="overflow-hidden rounded-xl border border-rule bg-card shadow-card">
        <div className="grid grid-cols-[1.4fr_1fr_140px_140px_120px_100px] gap-3 border-b border-rule bg-paper-2 px-5 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
          <span>Domain</span>
          <span>Client</span>
          <span>Status</span>
          <span>Added</span>
          <span>Last checked</span>
          <span className="text-right">Open</span>
        </div>
        {isLoading ? (
          <div className="px-5 py-4 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-quiet">
            {'// Loading…'}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-6 text-[13px] text-ink-quiet">
            No domains match the current filters.
          </div>
        ) : (
          filtered.map((row) => {
            const client = clientLookup.get(row.client_id);
            const stuck =
              (row.status === 'pending_dns' ||
                row.status === 'verifying' ||
                row.status === 'ssl_pending') &&
              ageHours(row.added_at) > 24;
            return (
              <div
                key={row.id}
                className="grid grid-cols-[1.4fr_1fr_140px_140px_120px_100px] items-center gap-3 border-b border-rule px-5 py-3 last:border-b-0 hover:bg-paper-2/50"
              >
                <div className="flex items-center gap-2 truncate">
                  <span className={`h-2 w-2 rounded-full ${STATUS_DOT_CLASS[row.status]}`} />
                  <span className="truncate font-mono text-[13px] text-ink" title={row.domain}>
                    {row.domain}
                  </span>
                  {row.is_primary ? (
                    <span className="rounded-full bg-rust/12 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-rust">
                      Primary
                    </span>
                  ) : null}
                  {stuck ? (
                    <span
                      className="rounded-full bg-warn/12 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-warn"
                      title="In-flight for more than 24 hours — likely needs operator attention"
                    >
                      Stuck
                    </span>
                  ) : null}
                </div>
                <span className="truncate text-[13px] text-ink">
                  {client?.name ?? row.client_id.slice(0, 8)}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                  {STATUS_LABEL[row.status]}
                </span>
                <span className="font-mono text-[11px] text-ink-quiet">{formatAge(row.added_at)}</span>
                <span className="font-mono text-[11px] text-ink-quiet">
                  {row.last_checked_at ? formatAge(row.last_checked_at) : '—'}
                </span>
                <div className="flex justify-end">
                  <Button type="button" size="sm" variant="secondary" onClick={() => drillIn(row)}>
                    Open →
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function FilterChipGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`rounded-full px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.14em] transition-colors ${
                active
                  ? 'bg-rust text-paper'
                  : 'bg-paper-2 text-ink-soft hover:bg-paper-3'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
