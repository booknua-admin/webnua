'use client';

// =============================================================================
// /admin/signups — Pattern B operator visibility surface.
//
// One page, two tables:
//   • Pre-published workspaces (pending_verification + preview + onboarding) —
//     the conversion pipeline. Operator sees who's waiting on email verify,
//     who's mid-wizard, and who's been sitting in preview for too long. Per-
//     row actions: Verify (manually transition pending_verification → preview),
//     Activate (concierge close: → active), Open (drill into the sub-account
//     dashboard), Ban (lifecycle_status → banned).
//   • Recent rate-limit blocks — the abuse log. Last 50 'blocked' rows from
//     rate_limit_hits. Operator-only audit; no per-row action (the limits
//     are time-based, blocks unblock themselves).
//
// Operator-only (the `(admin)` route group is RLS-scoped + nav-hidden from
// client users). Reads via the real clients-store + rate_limit_hits.
// =============================================================================

import { useEffect, useMemo, useState } from 'react';

import { PageHeader } from '@/components/shared/PageHeader';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import { LIFECYCLE_LABEL } from '@/lib/auth/lifecycle';
import { useRole } from '@/lib/auth/user-stub';
import {
  hydrateClients,
  useAdminClients,
} from '@/lib/clients/clients-store';
import { supabase } from '@/lib/supabase/client';
import { useWorkspace } from '@/lib/workspace/workspace-stub';

type AdminAction = 'verify' | 'activate' | 'ban' | null;

type RateLimitRow = {
  id: string;
  action: string;
  key: string;
  ip: string | null;
  client_id: string | null;
  status: string;
  reason: string | null;
  occurred_at: string;
};

const PRE_PUBLISHED_STATES = new Set([
  'pending_verification',
  'preview',
  'onboarding',
]);

const DATE_FORMATTER = new Intl.DateTimeFormat('en-AU', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export default function AdminSignupsPage() {
  const { role } = useRole();
  const clients = useAdminClients();
  const workspace = useWorkspace();

  // Self-gate — the layout enforces admin role at the layout level, but a
  // direct navigation that beats hydration would briefly render a wrong
  // surface. Hooks run unconditionally above; the early return below uses
  // the resolved values.
  const prePublished = useMemo(
    () => clients.filter((c) => PRE_PUBLISHED_STATES.has(c.lifecycleStatus)),
    [clients],
  );
  if (role !== 'admin') {
    return null;
  }

  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb current="Signups" />} />
      <div className="flex flex-col gap-7 px-10 py-10">
        <PageHeader
          className="mb-0"
          eyebrow="// Pattern B · operator visibility"
          title={
            <>
              Signups + <em>preview workspaces</em>.
            </>
          }
          subtitle={
            <>
              <strong>The conversion pipeline.</strong> Every workspace
              that&rsquo;s started but not yet published. Use Verify to
              concierge-confirm an email; Activate to mark a workspace paid
              out-of-band; Open to drill into the workspace; Ban to lock out
              an abusive account.
            </>
          }
        />

        <PrePublishedTable
          rows={prePublished}
          onDrillIn={(slug) => workspace.setActiveClientId(slug)}
        />

        <RateLimitHitsTable />
      </div>
    </>
  );
}

// --- pre-published table ----------------------------------------------------

type PrePublishedRow = {
  id: string;
  initial: string;
  name: string;
  meta: string;
  lifecycleStatus: string;
};

function PrePublishedTable({
  rows,
  onDrillIn,
}: {
  rows: PrePublishedRow[];
  onDrillIn: (slug: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-rule bg-paper-2 px-6 py-10 text-center">
        <div className="text-[14px] font-semibold text-ink">
          No workspaces in pre-published state.
        </div>
        <p className="mt-1 text-[13px] leading-[1.5] text-ink-quiet">
          Every client is either verified + paying or has not signed up yet.
          New self-serve signups appear here as soon as they hit /sign-up.
        </p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-rule bg-card">
      <div className="grid grid-cols-[36px_1fr_140px_1fr] items-center gap-3 border-b border-rule bg-paper-2 px-5 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
        <span aria-hidden />
        <span>Client</span>
        <span>State</span>
        <span className="text-right">Actions</span>
      </div>
      {rows.map((row) => (
        <SignupRow key={row.id} row={row} onDrillIn={onDrillIn} />
      ))}
    </div>
  );
}

function SignupRow({
  row,
  onDrillIn,
}: {
  row: PrePublishedRow;
  onDrillIn: (slug: string) => void;
}) {
  const [pending, setPending] = useState<AdminAction>(null);
  const [error, setError] = useState<string | null>(null);

  const doTransition = async (next: 'preview' | 'active' | 'banned', tag: AdminAction) => {
    if (pending) return;
    setPending(tag);
    setError(null);
    try {
      // Resolve slug → UUID inline. clients_update is operator-only RLS, so
      // a client-role user calling this would just get a 403 — defensive on
      // top of the layout's role gate.
      const { data: client, error: lookupError } = await supabase
        .from('clients')
        .select('id')
        .eq('slug', row.id)
        .maybeSingle();
      if (lookupError || !client) {
        setError('Could not find that client.');
        setPending(null);
        return;
      }
      const { error: updateError } = await supabase
        .from('clients')
        // The 'preview' / 'active' / 'banned' values were added in
        // migration 0084; the generated Database type doesn't carry them
        // yet, so cast through `as never`.
        .update({ lifecycle_status: next as never })
        .eq('id', (client as { id: string }).id);
      if (updateError) {
        setError(updateError.message);
        setPending(null);
        return;
      }
      await hydrateClients();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed.');
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="grid grid-cols-[36px_1fr_140px_1fr] items-center gap-3 border-b border-rule last:border-b-0 px-5 py-3.5">
      <div className="flex size-9 items-center justify-center rounded-lg bg-ink font-sans text-sm font-extrabold text-rust-light">
        {row.initial}
      </div>
      <div className="min-w-0">
        <div className="truncate text-[14px] font-semibold text-ink">{row.name}</div>
        <div className="mt-0.5 truncate font-mono text-[11px] tracking-[0.04em] text-ink-quiet">
          {row.meta}
        </div>
      </div>
      <LifecyclePill status={row.lifecycleStatus} />
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {row.lifecycleStatus === 'pending_verification' ? (
          <Button
            size="sm"
            variant="outline"
            disabled={pending !== null}
            onClick={() => doTransition('preview', 'verify')}
          >
            {pending === 'verify' ? 'Verifying…' : 'Verify'}
          </Button>
        ) : null}
        {row.lifecycleStatus !== 'banned' ? (
          <Button
            size="sm"
            disabled={pending !== null}
            onClick={() => doTransition('active', 'activate')}
          >
            {pending === 'activate' ? 'Activating…' : 'Activate'}
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            onDrillIn(row.id);
            // The drill-in switches workspace context; the dashboard then
            // renders the wizard surface for this client.
            window.location.href = '/dashboard';
          }}
        >
          Open →
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={pending !== null}
          onClick={() => {
            const ok = window.confirm(
              `Ban ${row.name}? Their public site stops rendering and the dashboard locks out.`,
            );
            if (ok) void doTransition('banned', 'ban');
          }}
        >
          {pending === 'ban' ? 'Banning…' : 'Ban'}
        </Button>
        {error ? (
          <span className="basis-full pt-1 text-right text-[11px] text-warn">{error}</span>
        ) : null}
      </div>
    </div>
  );
}

function LifecyclePill({ status }: { status: string }) {
  const label = LIFECYCLE_LABEL[status as keyof typeof LIFECYCLE_LABEL] ?? status;
  const className =
    status === 'pending_verification'
      ? 'bg-warn/12 text-warn'
      : status === 'preview'
        ? 'bg-rust/12 text-rust'
        : status === 'banned'
          ? 'bg-ink/[0.06] text-ink-quiet'
          : 'bg-ink/[0.06] text-ink';
  return (
    <span
      className={
        'inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] ' +
        className
      }
    >
      {label}
    </span>
  );
}

// --- rate-limit hits log ----------------------------------------------------

function RateLimitHitsTable() {
  const [rows, setRows] = useState<RateLimitRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const untyped = supabase as unknown as {
        from: (t: string) => {
          select: (s: string) => {
            eq: (k: string, v: unknown) => {
              order: (
                k: string,
                opts: { ascending: boolean },
              ) => {
                limit: (n: number) => Promise<{
                  data: RateLimitRow[] | null;
                  error: { message: string } | null;
                }>;
              };
            };
          };
        };
      };
      const { data, error: fetchError } = await untyped
        .from('rate_limit_hits')
        .select('id, action, key, ip, client_id, status, reason, occurred_at')
        .eq('status', 'blocked')
        .order('occurred_at', { ascending: false })
        .limit(50);
      if (!active) return;
      if (fetchError) {
        // PGRST205 = table not found (migrations not deployed). Treat as
        // an empty list rather than a hard error — keeps the rest of the
        // page useful on a fresh deploy.
        const friendlyEmpty = /not.*found|relation.*does not exist|PGRST205/i.test(
          fetchError.message,
        );
        if (friendlyEmpty) {
          setRows([]);
          return;
        }
        setError(fetchError.message);
        return;
      }
      setRows(data ?? []);
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="rounded-xl border border-rule bg-card">
      <div className="border-b border-rule px-5 py-3">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
          {'// Recent rate-limit blocks'}
        </div>
        <p className="mt-1 text-[12px] leading-[1.5] text-ink-quiet">
          Last 50 blocked attempts across the platform. Read-only — limits
          unblock automatically when the window passes.
        </p>
      </div>
      {error ? (
        <div className="px-5 py-4 text-[13px] text-warn">Could not load: {error}</div>
      ) : rows === null ? (
        <div className="px-5 py-4 text-[13px] text-ink-quiet">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="px-5 py-4 text-[13px] text-ink-quiet">
          No recent blocks. Nothing has tripped a rate limit yet.
        </div>
      ) : (
        <div className="divide-y divide-rule">
          {rows.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-[160px_1fr_180px_180px] items-center gap-3 px-5 py-2.5 text-[12px]"
            >
              <span className="font-mono uppercase tracking-[0.04em] text-ink">
                {row.action}
              </span>
              <span className="font-mono text-[11px] text-ink-quiet truncate">
                {row.ip ?? row.client_id ?? row.key}
              </span>
              <span className="text-ink-quiet truncate">{row.reason ?? '—'}</span>
              <span className="text-right font-mono text-[11px] text-ink-quiet">
                {DATE_FORMATTER.format(new Date(row.occurred_at))}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

