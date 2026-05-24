// =============================================================================
// POST /api/automations/test-send — operator test send.
//
// The "Send test now" button in the automation editor's test-send card POSTs
// here. The route is operator-only (`requireOperatorForClient`). It resolves
// the picked action's body off `automation_actions.action_config`, renders
// the {{variable}} placeholders against a curated sample context, and
// enqueues a `send_sms` or `send_email` job through the existing handlers.
//
// SMS-test path needs an operator phone. `public.users` has no phone column
// today — the route degrades to a clear `no-test-phone` error so the modal
// can surface "Add your phone in Settings to enable test SMS"; the email
// path uses the signed-in operator's auth email.
// =============================================================================

import { NextResponse } from 'next/server';

import { enqueueJobImmediate } from '@/lib/integrations/_shared/jobs';
import { requireOperatorForClient } from '@/lib/integrations/_shared/operator-auth';
import {
  SEND_EMAIL_JOB,
  type SendEmailPayload,
} from '@/lib/integrations/resend/job-types';
import { getServiceClient } from '@/lib/supabase/server';

/** Curated sample context — matches the values surfaced by the SMS / email
 *  template-variable catalogues so the test send reads like a typical lead.
 *  Keys are the bare placeholder names (no braces). */
const SAMPLE_CONTEXT: Record<string, string> = {
  'client.shortName': 'Voltline',
  'client.businessName': 'Voltline Electrical',
  'client.phone': '0412 345 678',
  'client.responseTime': '1 hour',
  'lead.firstName': 'Liam',
  'lead.lastNameSuffix': ' Reilly',
  'lead.fullName': 'Liam Reilly',
  'lead.email': 'liam@example.com',
  'lead.phone': '+61 412 345 678',
  'lead.service': 'kitchen power outlet replacement',
  'lead.preview':
    'Outlet by the sink keeps tripping the breaker — need someone today.',
  'review.link': 'https://g.page/voltline/review',
  'platform.inboxLink': 'https://app.webnua.com/leads',
};

export async function POST(request: Request): Promise<Response> {
  let body: {
    clientId?: unknown;
    actionId?: unknown;
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
  const actionId = body.actionId;
  if (typeof actionId !== 'string' || actionId.length === 0) {
    return NextResponse.json({ error: 'missing-actionId' }, { status: 400 });
  }

  const auth = await requireOperatorForClient(request, clientId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const svc = getServiceClient();

  // Load the action — needs action_type + action_config (body / subject).
  const { data: action, error: actionErr } = await svc
    .from('automation_actions')
    .select('id, action_type, action_config, automation_id')
    .eq('id', actionId)
    .single();
  if (actionErr || !action) {
    return NextResponse.json({ error: 'action-not-found' }, { status: 404 });
  }
  const row = action as {
    action_type: string;
    action_config: Record<string, unknown> | null;
    automation_id: string;
  };
  const cfg = row.action_config ?? {};

  // Cross-check: the action belongs to an automation on the resolved client.
  // RLS already gates by accessible_client_ids, but a junior operator on
  // multiple clients could be poking around — verify the join.
  const { data: autom } = await svc
    .from('automations')
    .select('client_id')
    .eq('id', row.automation_id)
    .single();
  if (!autom || (autom as { client_id: string }).client_id !== clientId) {
    return NextResponse.json({ error: 'action-not-found' }, { status: 404 });
  }

  // Resolve the operator's auth email (for email tests) — `public.users`
  // mirrors it on `email` but the auth identity is the source of truth.
  const { data: userRow } = await svc
    .from('users')
    .select('email')
    .eq('id', auth.userId)
    .single();
  const operatorEmail = (userRow as { email?: string } | null)?.email ?? '';

  if (row.action_type === 'send_sms_to_lead') {
    // We need a phone to send to. `public.users` has no phone column today;
    // surface a clear error the modal can translate into actionable copy.
    return NextResponse.json(
      {
        error: 'no-test-phone',
        message:
          'Add your phone in Settings to enable SMS test send. Until then, switch to the email channel to test.',
      },
      { status: 400 },
    );
  }

  if (row.action_type === 'send_email_to_lead') {
    if (!operatorEmail) {
      return NextResponse.json({ error: 'no-test-email' }, { status: 400 });
    }
    const subject = typeof cfg.subject === 'string' ? cfg.subject : '(no subject)';
    const bodyText = typeof cfg.body_text === 'string' ? cfg.body_text : '';
    const bodyHtml = typeof cfg.body_html === 'string' ? cfg.body_html : '';
    if (!bodyText && !bodyHtml) {
      return NextResponse.json({ error: 'empty-body' }, { status: 400 });
    }

    const payload: SendEmailPayload = {
      clientId,
      templateKey: 'lead_followup',
      recipientEmail: operatorEmail,
      recipientName: 'Test recipient (operator)',
      subject: `[TEST] ${subject}`,
      bodyText,
      bodyHtml,
      contextOverrides: SAMPLE_CONTEXT,
      sentByUserId: auth.userId,
    };
    const jobId = await enqueueJobImmediate(SEND_EMAIL_JOB, payload, {
      provider: 'resend',
      clientId,
    });
    return NextResponse.json({
      enqueued: true,
      jobId,
      channel: 'email',
      recipient: operatorEmail,
    });
  }

  return NextResponse.json(
    { error: 'unsupported-action-type', actionType: row.action_type },
    { status: 400 },
  );
}

// Surface the sample context to the modal so the preview matches the send.
export function GET(): Response {
  return NextResponse.json({ sampleContext: SAMPLE_CONTEXT });
}
