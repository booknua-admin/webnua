// =============================================================================
// POST /api/integrations/resend/test-notification — operator test send.
//
// Phase 7 Resend session. Operator-only. The "Test send" button on the
// notification settings UI POSTs here; the route enqueues a
// send_test_notification job which fans into a send_email with synthetic
// lead data. Lets an operator verify their email is configured before a
// real lead lands.
// =============================================================================

import { NextResponse } from 'next/server';

import { enqueueJobImmediate } from '@/lib/integrations/_shared/jobs';
import { requireOperatorForClient } from '@/lib/integrations/_shared/operator-auth';
import {
  SEND_TEST_NOTIFICATION_JOB,
  type SendTestNotificationPayload,
} from '@/lib/integrations/resend/job-types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request): Promise<Response> {
  let body: { clientId?: unknown; recipientEmail?: unknown };
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

  const rawEmail = body.recipientEmail;
  if (typeof rawEmail !== 'string' || !rawEmail.trim()) {
    return NextResponse.json({ error: 'missing-email' }, { status: 400 });
  }
  const recipientEmail = rawEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(recipientEmail)) {
    return NextResponse.json({ error: 'invalid-email' }, { status: 400 });
  }

  const payload: SendTestNotificationPayload = { clientId, recipientEmail };
  const jobId = await enqueueJobImmediate(SEND_TEST_NOTIFICATION_JOB, payload, {
    provider: 'resend',
    clientId,
  });
  return NextResponse.json({ enqueued: true, jobId });
}
