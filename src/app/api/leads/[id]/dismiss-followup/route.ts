// =============================================================================
// POST /api/leads/[id]/dismiss-followup — dismiss a cold-lead follow-up.
//
// Operator OR own-client. Sets leads.followup_dismissed_at = now() so the
// lead drops off the GET /api/leads/needs-followup surface. The
// followup_nudge_count is preserved (so the next scan respects the 3-nudge
// cap).
// =============================================================================

import { NextResponse } from 'next/server';

import { dismissFollowupTask } from '@/lib/automations/handoff';
import { requireLeadAccess } from '@/lib/automations/lead-access';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: leadId } = await context.params;
  if (!leadId) return NextResponse.json({ error: 'missing-lead-id' }, { status: 400 });
  const auth = await requireLeadAccess(request, leadId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  await dismissFollowupTask(leadId, auth.userId);
  return NextResponse.json({ ok: true });
}
