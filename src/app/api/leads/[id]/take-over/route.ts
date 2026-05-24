// =============================================================================
// POST /api/leads/[id]/take-over — flip a lead to taken_over state.
//
// Operator OR own-client. Calls handoff.takeoverLead which (a) sets
// automation_state='taken_over', taken_over_at, taken_over_by; (b) pauses
// every running automation_run on the lead with paused_reason='client_took_over'.
// =============================================================================

import { NextResponse } from 'next/server';

import { takeoverLead } from '@/lib/automations/handoff';
import { requireLeadAccess } from '@/lib/automations/lead-access';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: leadId } = await context.params;
  if (!leadId) return NextResponse.json({ error: 'missing-lead-id' }, { status: 400 });
  const auth = await requireLeadAccess(request, leadId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const result = await takeoverLead(leadId, auth.userId);
  return NextResponse.json({ ok: true, pausedRunCount: result.pausedRunCount });
}
