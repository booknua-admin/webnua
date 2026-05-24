// =============================================================================
// GET /api/leads/[id]/automation-state — lead's automation + handoff state.
//
// Returns:
//   • The lead's automation_state, take-over metadata, follow-up state.
//   • Active automation runs (running + paused) with their automation name,
//     current action position, total action count, and paused reason if any.
//   • An "upcoming" hint for each running run — the position-next action
//     type + the next-run timestamp from the integration_jobs table.
//
// Caller: any user who can see the lead via RLS (operator or own-client).
// =============================================================================

import { NextResponse } from 'next/server';

import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';
import { requireLeadAccess } from '@/lib/automations/lead-access';

type RunSummary = {
  id: string;
  automationId: string;
  automationName: string;
  status: string;
  pausedReason: string | null;
  startedAt: string;
  pausedAt: string | null;
  currentActionPosition: number;
  totalActions: number;
  nextActionType: string | null;
  nextRunAt: string | null;
};

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: leadId } = await context.params;
  if (!leadId) return NextResponse.json({ error: 'missing-lead-id' }, { status: 400 });

  const auth = await requireLeadAccess(request, leadId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // Use the untyped service-role client because the generated DB types
  // don't yet include the new automation_state / needs_followup_at columns
  // (regen happens after migrations apply). Same pattern as the other
  // Phase 7+8 integration routes.
  const svc = getIntegrationDb();
  const { data: leadData } = await svc
    .from('leads')
    .select(
      'id, status, automation_state, taken_over_at, taken_over_by, needs_followup_at, followup_dismissed_at, followup_nudge_count, last_inbound_at, last_outbound_at',
    )
    .eq('id', leadId)
    .maybeSingle();
  if (!leadData) return NextResponse.json({ error: 'lead-not-found' }, { status: 404 });
  const lead = leadData as Record<string, unknown>;

  // Active runs — running + paused. Limit to recent for the surface.
  const { data: runs } = await svc
    .from('automation_runs')
    .select(
      'id, automation_id, status, paused_reason, started_at, paused_at, current_action_position, automation:automations(name)',
    )
    .eq('lead_id', leadId)
    .in('status', ['running', 'paused'])
    .order('started_at', { ascending: false })
    .limit(20);

  const summaries: RunSummary[] = [];
  for (const r of (runs ?? []) as unknown as Array<{
    id: string;
    automation_id: string;
    status: string;
    paused_reason: string | null;
    started_at: string;
    paused_at: string | null;
    current_action_position: number;
    automation: { name: string } | null;
  }>) {
    // Total + next-action-type.
    const { data: actionRows } = await svc
      .from('automation_actions')
      .select('position, action_type')
      .eq('automation_id', r.automation_id)
      .order('position', { ascending: true });
    const actions = (actionRows ?? []) as Array<{ position: number; action_type: string }>;
    const totalActions = actions.length;
    const nextAction = actions.find((a) => a.position === r.current_action_position);

    // Find the upcoming integration_jobs row (if any).
    const { data: jobRow } = await svc
      .from('integration_jobs')
      .select('run_after, status')
      .eq('job_type', 'automation_action')
      .eq('correlation_id', r.id)
      .eq('status', 'pending')
      .order('run_after', { ascending: true })
      .limit(1)
      .maybeSingle();
    const job = jobRow as { run_after: string | null; status: string } | null;

    summaries.push({
      id: r.id,
      automationId: r.automation_id,
      automationName: r.automation?.name ?? 'Automation',
      status: r.status,
      pausedReason: r.paused_reason,
      startedAt: r.started_at,
      pausedAt: r.paused_at,
      currentActionPosition: r.current_action_position,
      totalActions,
      nextActionType: nextAction?.action_type ?? null,
      nextRunAt: job?.run_after ?? null,
    });
  }

  return NextResponse.json({
    lead: {
      id: leadId,
      status: lead.status as string | null,
      automationState: lead.automation_state as string,
      takenOverAt: lead.taken_over_at as string | null,
      takenOverBy: lead.taken_over_by as string | null,
      needsFollowupAt: lead.needs_followup_at as string | null,
      followupDismissedAt: lead.followup_dismissed_at as string | null,
      followupNudgeCount: (lead.followup_nudge_count as number | null) ?? 0,
      lastInboundAt: lead.last_inbound_at as string | null,
      lastOutboundAt: lead.last_outbound_at as string | null,
    },
    runs: summaries,
  });
}
