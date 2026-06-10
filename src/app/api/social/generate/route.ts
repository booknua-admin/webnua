// =============================================================================
// POST /api/social/generate — draft the next 30 days of social posts.
//
// Body: { clientId }. Client-or-operator (the calendar belongs to the
// customer's own business). Enqueues generate_social_calendar on the jobs
// spine and returns immediately — the drafts appear on /social as the job
// completes (~10-20s; the UI polls the list).
// =============================================================================

import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { enqueueJobImmediate } from '@/lib/integrations/_shared/jobs';
import { requireClientAccess } from '@/lib/integrations/_shared/operator-auth';
import { GENERATE_SOCIAL_CALENDAR_JOB } from '@/lib/social/job-handlers';

export async function POST(request: Request): Promise<Response> {
  let body: { clientId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }
  const clientId = typeof body.clientId === 'string' ? body.clientId : '';
  if (!clientId) {
    return NextResponse.json({ error: 'missing-clientId' }, { status: 400 });
  }

  const auth = await requireClientAccess(request, clientId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'anthropic-not-configured' }, { status: 503 });
  }

  const jobId = await enqueueJobImmediate(
    GENERATE_SOCIAL_CALENDAR_JOB,
    { clientId },
    { provider: 'anthropic', clientId, correlationId: clientId },
  );
  return NextResponse.json({ ok: true, jobId });
}
