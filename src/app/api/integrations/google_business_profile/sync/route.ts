// =============================================================================
// /api/integrations/google_business_profile/sync
//
// Operator-only "Sync now" — manually enqueues a gbp_sync_reviews job. The
// daily cron already runs (migration 0069) so this is the impatient path:
// pull recent reviews + refresh the location's headline metrics without
// waiting for tomorrow's tick.
//
//   POST { clientId } — refreshLocation always true on the manual path.
// =============================================================================

import { NextResponse } from 'next/server';

import { enqueueJobImmediate } from '@/lib/integrations/_shared/jobs';
import { requireOperatorForClient } from '@/lib/integrations/_shared/operator-auth';
import { isGbpConfigured } from '@/lib/integrations/gbp/client';
import {
  GBP_SYNC_REVIEWS_JOB,
  type GbpSyncReviewsPayload,
} from '@/lib/integrations/gbp/job-types';

export async function POST(request: Request): Promise<Response> {
  let body: { clientId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }
  const clientId = body.clientId;
  if (typeof clientId !== 'string' || clientId.length === 0) {
    return NextResponse.json({ error: 'missing-clientId' }, { status: 400 });
  }

  const auth = await requireOperatorForClient(request, clientId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!isGbpConfigured()) {
    return NextResponse.json({ error: 'gbp-not-configured' }, { status: 503 });
  }

  const jobId = await enqueueJobImmediate(
    GBP_SYNC_REVIEWS_JOB,
    { clientId, refreshLocation: true } satisfies GbpSyncReviewsPayload,
    { provider: 'google_business_profile', clientId },
  );
  return NextResponse.json({ enqueued: true, jobId });
}
