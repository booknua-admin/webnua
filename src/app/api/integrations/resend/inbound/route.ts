// =============================================================================
// POST /api/integrations/resend/inbound — Resend inbound email webhook.
//
// Phase 7 Resend session. Resend POSTs every inbound email delivered to
// *@{EMAIL_SENDING_DOMAIN} here. Authenticated by Svix-style signature
// (verified against RESEND_WEBHOOK_SECRET).
//
// Routing flow:
//   1. Verify the Svix signature.
//   2. Extract the recipient address. Parse the plus-addressed token back
//      to (clientSlug, threadToken).
//   3. Verify the thread token resolves a leadId (HMAC-signed in our system).
//   4. Cross-tenant guard — the resolved lead must belong to the resolved
//      client (a malicious correspondent who knew a leadId from a different
//      client's email can't smuggle it in).
//   5. Auto-responder detection — if `Auto-Submitted: auto-replied` /
//      `X-Autoreply` etc., record the row but flag it so the conversation
//      view filters it out.
//   6. Re-upload attachments to the email-attachments Storage bucket so the
//      conversation view can render them.
//   7. Insert the email_messages row.
//
// Rejection policy: 200 once the signature is verified (even on a routing
// failure — returning non-200 would make Resend retry indefinitely; an
// inbound to a bad address is operator-debug territory, not Resend's
// problem). 400 on a bad signature. 503 when unconfigured.
// =============================================================================

import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import {
  isValidThreadTokenShape,
  looksLikeAutoResponder,
  parseInboundAddress,
} from '@/lib/email/threading';
import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';
import { isInboundWebhookConfigured } from '@/lib/integrations/resend/client';
import {
  findOutboundByThreadToken,
  insertEmailMessage,
} from '@/lib/integrations/resend/messages';
import { findSenderByClientSlug } from '@/lib/integrations/resend/senders';
import type {
  EmailAttachment,
  ResendInboundEmail,
} from '@/lib/integrations/resend/types';
import { verifyResendWebhook } from '@/lib/integrations/resend/webhook-verify';
import { getServiceClient } from '@/lib/supabase/server';

function logInbound(
  operation: string,
  clientId: string | null,
  requestShape: unknown,
  responseStatus: number,
  errorClass: 'auth_failed' | 'non_retryable' | null,
  errorMessage: string | null,
): void {
  void (async () => {
    try {
      await getIntegrationDb().from('integration_call_log').insert({
        provider: 'resend',
        operation,
        direction: 'inbound',
        request_shape: requestShape,
        response_status: responseStatus,
        response_shape: null,
        latency_ms: null,
        error_class: errorClass,
        error_message: errorMessage,
        client_id: clientId,
        correlation_id: null,
      });
    } catch (error) {
      console.warn('[resend/inbound] call-log write failed', error);
    }
  })();
}

export async function POST(request: Request): Promise<Response> {
  if (!isInboundWebhookConfigured()) {
    return NextResponse.json({ error: 'resend-inbound-not-configured' }, { status: 503 });
  }

  const rawBody = await request.text();

  // --- 1. Verify signature ---------------------------------------------------
  const verify = verifyResendWebhook(
    rawBody,
    request.headers,
    env.RESEND_WEBHOOK_SECRET as string,
  );
  if (!verify.ok) {
    logInbound(
      'inbound_email',
      null,
      { reason: verify.reason },
      400,
      'auth_failed',
      `verify: ${verify.reason}`,
    );
    return NextResponse.json({ error: 'invalid-signature' }, { status: 400 });
  }

  // --- 2. Parse payload ------------------------------------------------------
  let payload: { type?: string; data?: ResendInboundEmail };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    logInbound('inbound_email', null, { reason: 'bad-json' }, 200, null, 'bad-json');
    return NextResponse.json({ received: true });
  }
  // Resend wraps events: { type: 'email.received', data: { … } }. We expect
  // `email.received`; anything else is logged + ignored.
  if (payload.type && payload.type !== 'email.received') {
    logInbound(
      'inbound_email',
      null,
      { type: payload.type },
      200,
      null,
      'ignored-event-type',
    );
    return NextResponse.json({ received: true });
  }
  const email = payload.data;
  if (!email) {
    logInbound('inbound_email', null, { reason: 'no-data' }, 200, null, 'no-data');
    return NextResponse.json({ received: true });
  }

  // --- 3. Resolve recipient -> (clientSlug, threadToken) --------------------
  const toAddress = firstAddress(email.to);
  if (!toAddress) {
    logInbound('inbound_email', null, { reason: 'no-recipient' }, 200, null, 'no-recipient');
    return NextResponse.json({ received: true });
  }
  const parsed = parseInboundAddress(toAddress);
  if (!parsed) {
    // Mail to a non-plus address (e.g. craig@mail.webnua.com directly) — we
    // log it but do not insert. The operator-facing inbox doesn't accept
    // unrouted inbound mail in V1; see the report at end of session.
    logInbound(
      'rejected_inbound',
      null,
      { to: toAddress, reason: 'not-thread-addressed' },
      200,
      'non_retryable',
      'not-thread-addressed',
    );
    return NextResponse.json({ received: true });
  }

  const sender = await findSenderByClientSlug(parsed.clientSlug);
  if (!sender) {
    logInbound(
      'rejected_inbound',
      null,
      { to: toAddress, clientSlug: parsed.clientSlug, reason: 'unknown-client' },
      200,
      'non_retryable',
      'unknown-client-slug',
    );
    return NextResponse.json({ received: true });
  }

  // --- 4. Resolve thread token via the DB -----------------------------------
  // Syntactic guard first — a malformed shape is rejected without a query.
  if (!isValidThreadTokenShape(parsed.threadToken)) {
    logInbound(
      'rejected_inbound',
      sender.client_id,
      { to: toAddress, reason: 'invalid-token-shape' },
      200,
      'auth_failed',
      'invalid-thread-token-shape',
    );
    return NextResponse.json({ received: true });
  }

  // The token was minted by us when an outbound send recorded a row on
  // email_messages with this thread_token. Look that row up.
  const originRow = await findOutboundByThreadToken(parsed.threadToken);
  if (!originRow) {
    // Unknown token — could be a stale forwarded reply, or a forged guess.
    // The 72-bit random space makes guessing infeasible; treat as junk.
    logInbound(
      'rejected_inbound',
      sender.client_id,
      { to: toAddress, reason: 'unknown-token' },
      200,
      'auth_failed',
      'unknown-thread-token',
    );
    return NextResponse.json({ received: true });
  }

  // Cross-tenant guard — the row the token resolves to must belong to the
  // same client the recipient slug resolves to. A malicious correspondent
  // who somehow obtained a token from a different client's email cannot
  // smuggle it in via this client's slug.
  if (originRow.client_id !== sender.client_id) {
    logInbound(
      'rejected_inbound',
      sender.client_id,
      { to: toAddress, reason: 'cross-tenant-token' },
      200,
      'auth_failed',
      'cross-tenant-token',
    );
    return NextResponse.json({ received: true });
  }
  if (!originRow.related_lead_id) {
    // A thread-tokened outbound without a lead is malformed; nothing to
    // route the reply to.
    logInbound(
      'rejected_inbound',
      sender.client_id,
      { to: toAddress, reason: 'token-no-lead' },
      200,
      'auth_failed',
      'thread-token-no-lead',
    );
    return NextResponse.json({ received: true });
  }
  const resolvedLeadId = originRow.related_lead_id;

  // Belt-and-braces: confirm the lead row itself still exists (handles a
  // lead deleted after the outbound was sent — FK is set-null, so
  // related_lead_id may now be stale on a re-read; if it is, refuse).
  const svc = getServiceClient();
  const { data: leadRow } = await svc
    .from('leads')
    .select('id, client_id')
    .eq('id', resolvedLeadId)
    .maybeSingle();
  if (!leadRow || (leadRow as { client_id: string }).client_id !== sender.client_id) {
    logInbound(
      'rejected_inbound',
      sender.client_id,
      { to: toAddress, reason: 'lead-deleted-or-cross-tenant' },
      200,
      'auth_failed',
      'lead-deleted-or-cross-tenant',
    );
    return NextResponse.json({ received: true });
  }

  // --- 5. Auto-responder detection -----------------------------------------
  const isAuto = looksLikeAutoResponder({
    subject: email.subject,
    headers: email.headers,
  });

  // --- 6. Attachment re-upload ---------------------------------------------
  const attachments = await reuploadAttachments(
    parsed.clientSlug,
    resolvedLeadId,
    email.attachments ?? [],
  );

  // --- 7. Insert email_messages row ----------------------------------------
  try {
    const row = await insertEmailMessage({
      client_id: sender.client_id,
      direction: 'inbound',
      sender_address: email.from ?? '',
      recipient_address: toAddress,
      reply_to_address: null,
      subject: email.subject ?? '',
      body_text: email.text ?? '',
      body_html: email.html ?? '',
      resend_message_id: email.id ?? null,
      in_reply_to_message_id: email.in_reply_to ?? null,
      status: 'received',
      related_lead_id: resolvedLeadId,
      thread_token: parsed.threadToken,
      attachments,
      is_auto_responder: isAuto,
    });

    // Also record a `email_in` lead_event so the existing lead-timeline UI
    // surfaces the reply without needing to query email_messages.
    if (!isAuto) {
      await svc.from('lead_events').insert({
        lead_id: resolvedLeadId,
        kind: 'email_in',
        occurred_at: new Date().toISOString(),
        actor_user_id: null,
        payload: {
          emailMessageId: row.id,
          subject: email.subject ?? '',
          body: email.text ?? stripHtml(email.html ?? ''),
          senderName: senderNameOf(email.from ?? ''),
          fromAddress: email.from ?? '',
        },
      });

      // Auto-status: an inbound reply on a `contacted` lead bumps it
      // back to `new` so the operator sees it as needing attention.
      // Other terminal statuses (booked / completed / lost) stay put —
      // a reply on a completed job is not a new lead to chase.
      // Best-effort: a status update failure does NOT fail the inbound.
      await maybeReturnToNew(resolvedLeadId);
    }
    logInbound(
      'inbound_email_received',
      sender.client_id,
      { messageId: row.id, isAuto, attachments: attachments.length },
      200,
      null,
      isAuto ? 'auto-responder' : null,
    );
    return NextResponse.json({ received: true, messageId: row.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[resend/inbound] insert failed', message);
    logInbound(
      'inbound_email',
      sender.client_id,
      { reason: 'insert-failed' },
      500,
      'non_retryable',
      message,
    );
    // 500 → Resend retries the inbound; a transient DB fault self-heals.
    return NextResponse.json({ error: 'insert-failed' }, { status: 500 });
  }
}

// --- helpers -----------------------------------------------------------------

function firstAddress(to: string | string[] | undefined): string | null {
  if (Array.isArray(to)) return to[0] ?? null;
  if (typeof to === 'string') return to;
  return null;
}

/** Pull a display name out of a `Display Name <addr@host>` string, or fall
 *  back to the local-part. */
function senderNameOf(from: string): string {
  if (!from) return '';
  const match = /^([^<]+?)\s*<[^>]+>$/.exec(from);
  if (match) return match[1].trim();
  const at = from.indexOf('@');
  if (at > 0) return from.slice(0, at);
  return from;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Move a `contacted` lead back to `new` after an inbound reply lands, so the
 *  operator sees it as needing attention again. Other statuses stay put.
 *  Best-effort: a failure does NOT fail the inbound webhook. */
async function maybeReturnToNew(leadId: string): Promise<void> {
  try {
    const svc = getServiceClient();
    const { data } = await svc
      .from('leads')
      .select('status')
      .eq('id', leadId)
      .maybeSingle();
    const status = (data as { status?: string } | null)?.status;
    if (status !== 'contacted') return;
    const { error: updateError } = await svc
      .from('leads')
      .update({ status: 'new' })
      .eq('id', leadId);
    if (updateError) {
      console.warn('[resend/inbound] auto-status update failed', updateError.message);
      return;
    }
    await svc.from('lead_events').insert({
      lead_id: leadId,
      kind: 'status_changed',
      occurred_at: new Date().toISOString(),
      actor_user_id: null,
      payload: { from: 'Contacted', to: 'New', auto: 'inbound-reply' },
    });
  } catch (error) {
    console.warn('[resend/inbound] auto-status threw', error);
  }
}

/** Re-upload inbound attachments to the email-attachments Storage bucket.
 *  Returns the EmailAttachment[] to store on the row. */
async function reuploadAttachments(
  clientSlug: string,
  leadId: string,
  attachments: NonNullable<ResendInboundEmail['attachments']>,
): Promise<EmailAttachment[]> {
  if (attachments.length === 0) return [];
  const svc = getServiceClient();
  const stored: EmailAttachment[] = [];

  for (const att of attachments) {
    if (!att.filename || !att.content) continue;
    const safeName = att.filename.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 200);
    // Path: {clientSlug}/inbound/{leadId}/{timestamp}-{filename}
    const path = `${clientSlug}/inbound/${leadId}/${Date.now()}-${safeName}`;
    try {
      const bytes = Buffer.from(att.content, 'base64');
      const { error } = await svc.storage
        .from('email-attachments')
        .upload(path, bytes, {
          contentType: att.content_type ?? 'application/octet-stream',
          upsert: false,
        });
      if (error) {
        console.warn('[resend/inbound] attachment upload failed', error.message);
        continue;
      }
      stored.push({
        filename: att.filename,
        content_type: att.content_type ?? 'application/octet-stream',
        storage_path: path,
        size_bytes: bytes.byteLength,
      });
    } catch (error) {
      console.warn('[resend/inbound] attachment processing failed', error);
    }
  }

  return stored;
}
