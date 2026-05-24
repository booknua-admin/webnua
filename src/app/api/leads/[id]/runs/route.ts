// =============================================================================
// GET /api/leads/[id]/runs — lead's full automation-run history (Phase 8 ·
// Session 4 follow-up; closes the `LeadAutomationPanel "View all runs"`
// parked carve-out).
//
// Distinct from /api/leads/[id]/automation-state which returns ACTIVE
// (running + paused) runs only. This returns EVERY run ever started on the
// lead, ordered newest first. Used by the LeadAutomationPanel's "View all
// runs" expansion.
//
// Caller: any user who can see the lead via RLS (operator or own-client).
// =============================================================================

import { NextResponse } from 'next/server';

import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';
import { requireLeadAccess } from '@/lib/automations/lead-access';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

type RunHistoryRow = {
  id: string;
  automationId: string;
  automationName: string;
  automationKey: string;
  status: string;
  pausedReason: string | null;
  startedAt: string;
  completedAt: string | null;
  pausedAt: string | null;
  errorMessage: string | null;
  currentActionPosition: number;
  totalActions: number;
};

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: leadId } = await context.params;
  if (!leadId) return NextResponse.json({ error: 'missing-lead-id' }, { status: 400 });

  const auth = await requireLeadAccess(request, leadId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = new URL(request.url);
  const rawLimit = Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(rawLimit)
    ? Math.max(1, Math.min(MAX_LIMIT, Math.floor(rawLimit)))
    : DEFAULT_LIMIT;

  const svc = getIntegrationDb();
  // Select runs + their automation. action_sequence carries the per-run
  // snapshot — length is the run's total action count (post-0080). For
  // legacy/empty sequences we fall back to 0 (the API consumer renders the
  // current-position number alone, which is honest).
  const { data, error } = await svc
    .from('automation_runs')
    .select(
      'id, automation_id, status, paused_reason, started_at, completed_at, paused_at, error_message, current_action_position, action_sequence, automation:automations(name, automation_key)',
    )
    .eq('lead_id', leadId)
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) {
    return NextResponse.json({ error: 'runs-lookup-failed', detail: error.message }, { status: 500 });
  }

  type DbRow = {
    id: string;
    automation_id: string;
    status: string;
    paused_reason: string | null;
    started_at: string;
    completed_at: string | null;
    paused_at: string | null;
    error_message: string | null;
    current_action_position: number;
    action_sequence: string[] | null;
    automation: { name: string; automation_key: string } | null;
  };
  const rows = (data ?? []) as unknown as DbRow[];
  const runs: RunHistoryRow[] = rows.map((row) => ({
    id: row.id,
    automationId: row.automation_id,
    automationName: row.automation?.name ?? row.automation_id,
    automationKey: row.automation?.automation_key ?? '',
    status: row.status,
    pausedReason: row.paused_reason,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    pausedAt: row.paused_at,
    errorMessage: row.error_message,
    currentActionPosition: row.current_action_position,
    totalActions: row.action_sequence?.length ?? 0,
  }));

  return NextResponse.json({ runs });
}
