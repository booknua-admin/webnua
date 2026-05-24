// =============================================================================
// POST /api/leads/[id]/reply — send a reply email from the lead inbox.
//
// Phase 7 Resend session. The "Reply" button on a lead's conversation view
// composes an email and POSTs here. The route validates the caller's access
// to the lead, then enqueues a send_email job carrying the operator-typed
// body. The send_email handler renders, sends through Resend, and inserts
// the email_messages row.
//
// Why a dedicated route (not just sending direct from the browser): the send
// has to write to email_messages + notifications_outbound + the call log,
// all service-role. The route also resolves the latest outbound email_message
// (so the new reply threads via In-Reply-To) and the lead's customer email.
// =============================================================================

import { NextResponse } from 'next/server';

import { wrapPlainAsHtml } from '@/lib/email/templates';
import { listMessagesForLead } from '@/lib/integrations/resend/messages';
import { getServiceClient } from '@/lib/supabase/server';
import { recordOutboundOnLead, takeoverLead } from '@/lib/automations/handoff';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Authenticate the caller and verify they may act on this lead. Returns the
 *  resolved (userId, lead) on success. Same RLS rule the inbox uses: a
 *  client sees its own leads; an operator sees their accessible clients. */
async function requireLeadAccess(
  request: Request,
  leadId: string,
): Promise<
  | { ok: true; userId: string; clientId: string }
  | { ok: false; status: number; error: string }
> {
  const header = request.headers.get('authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ')
    ? header.slice(7).trim()
    : '';
  if (!token) return { ok: false, status: 401, error: 'unauthenticated' };

  const svc = getServiceClient();
  const { data: userData, error: userError } = await svc.auth.getUser(token);
  if (userError || !userData.user) {
    return { ok: false, status: 401, error: 'unauthenticated' };
  }
  const userId = userData.user.id;

  // Use the service-role client to look up the lead's client; then verify
  // the user can see that client via accessible_client_ids (RLS). We do
  // the access check by reading `clients` as the user via the anon-bound
  // client — same trick as requireOperatorForClient.
  const { data: lead } = await svc
    .from('leads')
    .select('id, client_id')
    .eq('id', leadId)
    .maybeSingle();
  if (!lead) return { ok: false, status: 404, error: 'lead-not-found' };
  const clientId = (lead as { client_id: string }).client_id;

  const { createClient } = await import('@supabase/supabase-js');
  const { env } = await import('@/lib/env');
  const asUser = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const { data: clientCheck } = await asUser
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .maybeSingle();
  if (!clientCheck) {
    return { ok: false, status: 403, error: 'forbidden-lead' };
  }
  return { ok: true, userId, clientId };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: leadId } = await context.params;
  if (!leadId) {
    return NextResponse.json({ error: 'missing-lead-id' }, { status: 400 });
  }

  const auth = await requireLeadAccess(request, leadId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: { subject?: unknown; body?: unknown; html?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  const subject =
    typeof body.subject === 'string' && body.subject.trim()
      ? body.subject.trim().slice(0, 300)
      : '';
  const bodyText = typeof body.body === 'string' ? body.body.trim() : '';
  const bodyHtml = typeof body.html === 'string' ? body.html.trim() : '';
  if (!bodyText && !bodyHtml) {
    return NextResponse.json({ error: 'empty-body' }, { status: 400 });
  }

  // Resolve the recipient (the lead's customer email) and the In-Reply-To
  // (the most-recent outbound's Resend id, so the recipient's client threads
  // the conversation).
  const svc = getServiceClient();
  const { data: lead } = await svc
    .from('leads')
    .select(
      'id, customer_name_snapshot, customer:customers(email)',
    )
    .eq('id', leadId)
    .maybeSingle();
  type LeadShape = {
    customer_name_snapshot: string;
    customer: { email: string | null } | null;
  };
  const leadRow = lead as LeadShape | null;
  const recipientEmail = leadRow?.customer?.email ?? '';
  if (!recipientEmail || !EMAIL_RE.test(recipientEmail)) {
    return NextResponse.json({ error: 'no-recipient-email' }, { status: 400 });
  }

  // Find the most-recent outbound email to this lead for the In-Reply-To.
  const messages = await listMessagesForLead(leadId);
  const latestOutbound = [...messages]
    .reverse()
    .find((m) => m.direction === 'outbound' && m.resend_message_id);
  const inReplyTo = latestOutbound?.resend_message_id ?? null;

  // Determine the final subject. If the caller passed one, use it. Otherwise
  // derive from the most-recent inbound (a "Re: …" of what we're replying to)
  // or a sensible default.
  let finalSubject = subject;
  if (!finalSubject) {
    const latestInbound = [...messages]
      .reverse()
      .find((m) => m.direction === 'inbound');
    if (latestInbound?.subject) {
      finalSubject = latestInbound.subject.toLowerCase().startsWith('re:')
        ? latestInbound.subject
        : `Re: ${latestInbound.subject}`;
    } else {
      finalSubject = 'Replying to your enquiry';
    }
  }

  const finalText = bodyText || stripHtml(bodyHtml);
  const finalHtml = bodyHtml || wrapPlainAsHtml(bodyText);

  // The send_email job handler will load the template, but a reply does NOT
  // run through a template — the body is the operator's own composition.
  // We pass `contextOverrides` such that the chosen template renders nothing
  // (subject + bodies all blank) so we can short-circuit. The cleanest
  // approach is a dedicated `send_email_raw` job — but the existing handler
  // accepts a template; instead we go via lead_followup with overrides that
  // are empty, then layer the real body in via the contextOverrides…
  //
  // Actually simpler: write the email_messages row + dispatch Resend
  // synchronously here, bypassing the job machinery for the reply path.
  // The job spine is best when fan-out / retry matter; a direct reply does
  // not benefit (the operator is waiting on the result).
  //
  // We still record observability + call_log via the standard `sendEmail`
  // wrapper — same pattern as Stripe's sendOperatorEmail.

  const { sendEmail, isResendConfigured } = await import(
    '@/lib/integrations/resend/client'
  );
  const { generateThreadToken, composeReplyToAddress } = await import(
    '@/lib/email/threading'
  );
  const { getSenderByClientId } = await import('@/lib/integrations/resend/senders');
  const { insertEmailMessage } = await import('@/lib/integrations/resend/messages');
  const { env } = await import('@/lib/env');

  if (!isResendConfigured()) {
    return NextResponse.json({ error: 'resend-not-configured' }, { status: 503 });
  }

  const sender = await getSenderByClientId(auth.clientId);
  if (!sender || sender.status !== 'active') {
    return NextResponse.json({ error: 'no-active-sender' }, { status: 409 });
  }

  const threadToken = generateThreadToken();
  const replyTo = composeReplyToAddress(sender.slug, threadToken);
  const from = `${sender.display_name} <${sender.slug}@${env.EMAIL_SENDING_DOMAIN}>`;

  // Phase 8 Session 1 — a manual reply is the canonical "client took over"
  // signal: flip the lead to taken_over BEFORE sending so any in-flight
  // automation runs pause cleanly. Best-effort; a failure here must not
  // block the send.
  try {
    await takeoverLead(leadId, auth.userId);
  } catch (handoffError) {
    console.warn('[leads/reply] takeoverLead failed', handoffError);
  }

  const result = await sendEmail({
    clientId: auth.clientId,
    from,
    to: recipientEmail,
    replyTo,
    subject: finalSubject,
    text: finalText,
    html: finalHtml,
    inReplyTo: inReplyTo ?? undefined,
    correlationId: leadId,
  });

  if (!result.ok) {
    await insertEmailMessage({
      client_id: auth.clientId,
      direction: 'outbound',
      sender_address: from,
      recipient_address: recipientEmail,
      reply_to_address: replyTo,
      subject: finalSubject,
      body_text: finalText,
      body_html: finalHtml,
      status: 'failed',
      related_lead_id: leadId,
      thread_token: threadToken,
      in_reply_to_message_id: inReplyTo,
      sent_by: auth.userId,
    });
    return NextResponse.json(
      { error: 'resend-send-failed', detail: result.error.message },
      { status: 502 },
    );
  }

  const row = await insertEmailMessage({
    client_id: auth.clientId,
    direction: 'outbound',
    sender_address: from,
    recipient_address: recipientEmail,
    reply_to_address: replyTo,
    subject: finalSubject,
    body_text: finalText,
    body_html: finalHtml,
    resend_message_id: result.data.id,
    in_reply_to_message_id: inReplyTo,
    status: 'sent',
    related_lead_id: leadId,
    thread_token: threadToken,
    sent_by: auth.userId,
  });

  // Also record an `email_out` lead_event so the existing lead-timeline UI
  // surfaces the reply.
  await svc.from('lead_events').insert({
    lead_id: leadId,
    kind: 'email_out',
    occurred_at: new Date().toISOString(),
    actor_user_id: auth.userId,
    payload: {
      emailMessageId: row.id,
      subject: finalSubject,
      body: finalText,
      delivered: false,
    },
  });

  // Auto-status: replying to a `new` lead moves it to `contacted`. We
  // re-read the lead's current status (it may have shifted since the
  // initial requireLeadAccess fetch — e.g. operator manually changed
  // it mid-compose). Best-effort: a status update failure does NOT
  // fail the reply send.
  await maybeAdvanceToContacted(leadId, auth.userId);

  // Phase 8 Session 1 — update leads.last_outbound_at so the engine's
  // handoff pre-flight + cold-lead scanner see this manual reply.
  await recordOutboundOnLead(leadId);

  return NextResponse.json({ ok: true, messageId: row.id, resendId: result.data.id });
}

/** Auto-advance a `new` lead to `contacted` once the operator replies.
 *  Does NOT write a status_changed lead_event — the email_out event the
 *  reply already wrote carries the action, and the operator obviously
 *  knows they replied. Same discipline as the inbound auto-flip. */
async function maybeAdvanceToContacted(leadId: string, actorUserId: string): Promise<void> {
  void actorUserId; // attribution will return when status_changed lives elsewhere
  try {
    const svc = getServiceClient();
    const { data } = await svc
      .from('leads')
      .select('status')
      .eq('id', leadId)
      .maybeSingle();
    const status = (data as { status?: string } | null)?.status;
    if (status !== 'new') return;
    const { error: updateError } = await svc
      .from('leads')
      .update({ status: 'contacted' })
      .eq('id', leadId);
    if (updateError) {
      console.warn('[leads/reply] auto-status update failed', updateError.message);
    }
  } catch (error) {
    console.warn('[leads/reply] auto-status threw', error);
  }
}

function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
