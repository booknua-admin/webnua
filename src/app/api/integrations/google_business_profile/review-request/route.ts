// =============================================================================
// /api/integrations/google_business_profile/review-request
//
// Operator-only manual review-request send. The booking-completion trigger
// fires automatically; this route is the override for the cases the trigger
// misses — a job done off-platform, a customer who wasn't entered as a
// booking, a re-send. Same job handler (gbp_send_review_request) does the
// underlying work so the audit row + SMS/email send all flow through the
// same code path.
//
//   POST {
//     clientId,
//     recipientName?, recipientPhone?, recipientEmail?,
//     leadId?, bookingId?
//   }
//
// At least one of recipientPhone / recipientEmail must be present, or the
// job has no channel to pick. Returns the enqueued job id.
// =============================================================================

import { NextResponse } from 'next/server';

import { enqueueJobImmediate } from '@/lib/integrations/_shared/jobs';
import { requireOperatorForClient } from '@/lib/integrations/_shared/operator-auth';
import {
  GBP_SEND_REVIEW_REQUEST_JOB,
  type GbpSendReviewRequestPayload,
} from '@/lib/integrations/gbp/job-types';

export async function POST(request: Request): Promise<Response> {
  let body: {
    clientId?: unknown;
    recipientName?: unknown;
    recipientPhone?: unknown;
    recipientEmail?: unknown;
    leadId?: unknown;
    bookingId?: unknown;
  };
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

  const recipientName = stringOrNull(body.recipientName);
  const recipientPhone = stringOrNull(body.recipientPhone);
  const recipientEmail = stringOrNull(body.recipientEmail);
  const leadId = stringOrNull(body.leadId);
  const bookingId = stringOrNull(body.bookingId);

  if (!recipientPhone && !recipientEmail) {
    return NextResponse.json({ error: 'no-recipient-channel' }, { status: 400 });
  }

  const payload: GbpSendReviewRequestPayload = {
    clientId,
    bookingId,
    leadId,
    customerId: null,
    recipientName,
    recipientPhone,
    recipientEmail,
  };
  const jobId = await enqueueJobImmediate(GBP_SEND_REVIEW_REQUEST_JOB, payload, {
    provider: 'google_business_profile',
    clientId,
    correlationId: bookingId ?? leadId ?? undefined,
  });

  return NextResponse.json({ enqueued: true, jobId });
}

function stringOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
