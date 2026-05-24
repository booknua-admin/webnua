// =============================================================================
// GET /api/leads/needs-followup — leads surfaced as cold by the cold-lead
// scanner, awaiting a personal follow-up from the client/operator.
//
// Returns the leads where needs_followup_at IS NOT NULL AND
// followup_dismissed_at IS NULL, scoped to the caller's accessible clients
// (RLS — operators see their accessible clients' leads; a client sees their
// own).
//
// Each row carries enough context to render a "cold lead" surface row
// (Session 2 UI) — lead id, customer name, lead status, days since last
// outbound, nudge count, the operator who first took it over (if any).
// =============================================================================

import { NextResponse } from 'next/server';

import { getServiceClient } from '@/lib/supabase/server';

export async function GET(request: Request): Promise<Response> {
  // Authenticate. We use the same bearer-token shape as the lead-access
  // helper, but we don't have a specific lead to bound against — instead
  // we read the leads list AS the user (so RLS scopes the rows).
  const header = request.headers.get('authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const svc = getServiceClient();
  const { data: userData, error: userError } = await svc.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const { createClient } = await import('@supabase/supabase-js');
  const { env } = await import('@/lib/env');
  const asUser = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await asUser
    .from('leads')
    .select(
      'id, client_id, customer_name_snapshot, status, automation_state, last_outbound_at, last_inbound_at, needs_followup_at, followup_nudge_count, taken_over_by',
    )
    .not('needs_followup_at', 'is', null)
    .is('followup_dismissed_at', null)
    .order('needs_followup_at', { ascending: false });
  if (error) {
    return NextResponse.json({ error: 'lookup-failed', detail: error.message }, { status: 500 });
  }

  const leads = (data ?? []) as Array<{
    id: string;
    client_id: string;
    customer_name_snapshot: string | null;
    status: string | null;
    automation_state: string | null;
    last_outbound_at: string | null;
    last_inbound_at: string | null;
    needs_followup_at: string | null;
    followup_nudge_count: number | null;
    taken_over_by: string | null;
  }>;

  const rows = leads.map((l) => ({
    id: l.id,
    clientId: l.client_id,
    customerName: l.customer_name_snapshot ?? '',
    status: l.status ?? 'new',
    automationState: l.automation_state ?? 'automated',
    lastOutboundAt: l.last_outbound_at,
    lastInboundAt: l.last_inbound_at,
    needsFollowupAt: l.needs_followup_at,
    nudgeCount: l.followup_nudge_count ?? 0,
    takenOverBy: l.taken_over_by,
    daysSinceLastOutbound: l.last_outbound_at
      ? Math.floor((Date.now() - Date.parse(l.last_outbound_at)) / 86_400_000)
      : null,
  }));

  return NextResponse.json({ leads: rows, count: rows.length });
}
