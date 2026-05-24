// =============================================================================
// POST /api/leads/[id]/resume-automations — flip state back to 'automated'.
//
// Operator OR own-client. Calls handoff.resumeAutomations. Paused runs are
// NOT auto-resurrected (Session 2 surface) — the next trigger creates a
// fresh run on the lead.
// =============================================================================

import { NextResponse } from 'next/server';

import { resumeAutomations } from '@/lib/automations/handoff';
import { requireLeadAccess } from '@/lib/automations/lead-access';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: leadId } = await context.params;
  if (!leadId) return NextResponse.json({ error: 'missing-lead-id' }, { status: 400 });
  const auth = await requireLeadAccess(request, leadId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  await resumeAutomations(leadId);
  return NextResponse.json({ ok: true });
}
