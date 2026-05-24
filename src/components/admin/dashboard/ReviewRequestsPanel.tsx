'use client';

// =============================================================================
// ReviewRequestsPanel — operator-side surface listing clients with an open
// "request operator review before publishing" signal.
//
// Pattern B optional-path: a client in `preview` state can pick "Request
// operator review first" on the PublishToGoLiveCTA, which stamps
// `clients.review_requested_at`. This panel reads that column and surfaces
// the open requests for the operator to action.
//
// Lightweight by design — the brief explicitly scopes this as a SIGNAL to
// the operator, not a full approval workflow. The operator handles the
// actual review out-of-band (call, email, in-app message), then hits
// "Mark handled" to clear `review_requested_at`. Operators can also publish
// on the client's behalf via the existing Stripe Checkout if that's what
// the client asked for.
//
// Mounted on the agency-mode admin dashboard underneath the existing
// attention panels.
// =============================================================================

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { useWorkspace } from '@/lib/workspace/workspace-stub';
import { supabase } from '@/lib/supabase/client';

type ReviewRequestRow = {
  id: string;
  name: string;
  slug: string;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  review_requested_at: string;
};

export function ReviewRequestsPanel() {
  const { setActiveClientId } = useWorkspace();
  const [rows, setRows] = useState<ReviewRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [handling, setHandling] = useState<string | null>(null);

  const refresh = async () => {
    setError(null);
    const { data, error: queryError } = await supabase
      .from('clients')
      .select('id, name, slug, primary_contact_email, primary_contact_phone, review_requested_at')
      .not('review_requested_at', 'is', null)
      .order('review_requested_at', { ascending: false });
    if (queryError) {
      setError(queryError.message);
      setLoading(false);
      return;
    }
    setRows((data ?? []) as ReviewRequestRow[]);
    setLoading(false);
  };

  useEffect(() => {
    // Initial fetch on mount. refresh() updates local state from Supabase,
    // matching the "subscribe to external store" pattern useEffect is for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, []);

  async function markHandled(clientId: string) {
    if (handling) return;
    setHandling(clientId);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) {
        setError('Sign in again to mark handled.');
        return;
      }
      const res = await fetch(`/api/clients/${clientId}/clear-review-request`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Could not clear request (${res.status}).`);
        return;
      }
      // Local removal so the UI updates immediately; the next refresh
      // re-syncs against the DB.
      setRows((current) => current.filter((r) => r.id !== clientId));
    } finally {
      setHandling(null);
    }
  }

  // Hide the panel entirely when there are no open requests — it should not
  // claim dashboard real estate when there's nothing to action.
  if (!loading && rows.length === 0 && !error) {
    return null;
  }

  return (
    <div className="rounded-xl border border-rule bg-card px-6 py-5.5">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <div className="text-[16px] font-extrabold tracking-[-0.015em] text-ink">
          Review requests
        </div>
        {rows.length > 0 ? (
          <Eyebrow tone="rust">
            {`// ${rows.length} client${rows.length === 1 ? '' : 's'} waiting`}
          </Eyebrow>
        ) : null}
      </div>
      <p className="mb-4 text-[13px] leading-[1.5] text-ink-quiet">
        Clients who picked &ldquo;Request operator review first&rdquo; on the
        publish step. Reach out, walk them through their preview, then mark
        handled.
      </p>

      {loading ? (
        <div className="rounded-lg border border-dashed border-rule bg-paper px-5 py-4 text-[12px] text-ink-quiet">
          Loading…
        </div>
      ) : error ? (
        <div className="rounded-lg border border-warn/30 bg-warn/5 px-5 py-4 text-[12px] text-warn">
          {error}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-1 gap-3 rounded-lg border border-rule bg-paper px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4"
            >
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-ink">{row.name}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-quiet">
                  <span>Requested {formatRelative(row.review_requested_at)}</span>
                  {row.primary_contact_phone ? (
                    <a
                      href={`tel:${row.primary_contact_phone}`}
                      className="text-rust hover:text-rust-deep"
                    >
                      ☏ {row.primary_contact_phone}
                    </a>
                  ) : null}
                  {row.primary_contact_email ? (
                    <a
                      href={`mailto:${row.primary_contact_email}`}
                      className="text-rust hover:text-rust-deep"
                    >
                      ✉ {row.primary_contact_email}
                    </a>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveClientId(row.slug)}
                >
                  Drill in →
                </Button>
                <Button
                  size="sm"
                  onClick={() => void markHandled(row.id)}
                  disabled={handling === row.id}
                >
                  {handling === row.id ? 'Clearing…' : 'Mark handled'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const minutes = Math.floor((now - then) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
