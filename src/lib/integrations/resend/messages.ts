// =============================================================================
// Resend email — email_messages data access.
//
// Phase 7 Resend session. The conversation log: the send_email job inserts
// outbound rows (queued at submit, status updates via the delivery-webhook);
// the inbound webhook inserts inbound rows. email_messages (0061) is not in
// the generated Database type yet, so this reaches it through
// getIntegrationDb().
//
// SERVER-ONLY.
// =============================================================================

import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';

import type {
  EmailMessageInsert,
  EmailMessageRow,
  EmailMessageStatus,
} from './types';

const TABLE = 'email_messages';
const COLUMNS =
  'id, occurred_at, client_id, direction, sender_address, recipient_address, ' +
  'reply_to_address, subject, body_text, body_html, resend_message_id, ' +
  'in_reply_to_message_id, status, related_lead_id, thread_token, ' +
  'attachments, is_auto_responder, correlation_id, sent_by';

/** Insert one email_messages row (outbound send or inbound delivery). */
export async function insertEmailMessage(
  insert: EmailMessageInsert,
): Promise<EmailMessageRow> {
  const { data, error } = await getIntegrationDb()
    .from(TABLE)
    .insert({
      client_id: insert.client_id,
      direction: insert.direction,
      sender_address: insert.sender_address,
      recipient_address: insert.recipient_address,
      reply_to_address: insert.reply_to_address ?? null,
      subject: insert.subject ?? '',
      body_text: insert.body_text ?? '',
      body_html: insert.body_html ?? '',
      resend_message_id: insert.resend_message_id ?? null,
      in_reply_to_message_id: insert.in_reply_to_message_id ?? null,
      status: insert.status,
      related_lead_id: insert.related_lead_id ?? null,
      thread_token: insert.thread_token ?? null,
      attachments: insert.attachments ?? [],
      is_auto_responder: insert.is_auto_responder ?? false,
      correlation_id: insert.correlation_id ?? null,
      sent_by: insert.sent_by ?? null,
    })
    .select(COLUMNS)
    .single();
  if (error || !data) {
    throw new Error(`insertEmailMessage: ${error?.message ?? 'no row returned'}`);
  }
  return data as unknown as EmailMessageRow;
}

export type StatusUpdate = {
  status: EmailMessageStatus;
};

/**
 * Update an email_messages row's delivery status, found by its Resend
 * message id. Returns the resolved client_id (for call-log attribution) or
 * null when no row matches — a status callback for a message we did not send
 * (could happen during a partial deploy / cross-environment webhook).
 */
export async function updateStatusByResendId(
  resendMessageId: string,
  update: StatusUpdate,
): Promise<{ updated: boolean; clientId: string | null }> {
  const db = getIntegrationDb();
  const { data, error } = await db
    .from(TABLE)
    .update({ status: update.status })
    .eq('resend_message_id', resendMessageId)
    .select('client_id');
  if (error) throw new Error(`updateStatusByResendId: ${error.message}`);
  const rows = (data as { client_id: string }[] | null) ?? [];
  if (rows.length === 0) return { updated: false, clientId: null };
  return { updated: true, clientId: rows[0].client_id };
}

/** Look up an outbound row by its resend_message_id so an inbound reply can
 *  thread to it via the In-Reply-To header even when the plus-addressing
 *  token resolved nothing. */
export async function findOutboundByResendId(
  resendMessageId: string,
): Promise<EmailMessageRow | null> {
  const { data, error } = await getIntegrationDb()
    .from(TABLE)
    .select(COLUMNS)
    .eq('resend_message_id', resendMessageId)
    .eq('direction', 'outbound')
    .maybeSingle();
  if (error) throw new Error(`findOutboundByResendId: ${error.message}`);
  return (data as EmailMessageRow | null) ?? null;
}

/** Look up an inbound row by its resend_message_id. The inbound webhook
 *  uses this for replay-dedup — the Resend dashboard's "Replay" button
 *  re-POSTs the original payload, and we don't want to double-insert. */
export async function findInboundByResendId(
  resendMessageId: string,
): Promise<EmailMessageRow | null> {
  const { data, error } = await getIntegrationDb()
    .from(TABLE)
    .select(COLUMNS)
    .eq('resend_message_id', resendMessageId)
    .eq('direction', 'inbound')
    .maybeSingle();
  if (error) throw new Error(`findInboundByResendId: ${error.message}`);
  return (data as EmailMessageRow | null) ?? null;
}

/** Look up the outbound email_messages row that minted a thread token. The
 *  inbound webhook calls this to resolve (clientSlug, token) back to the
 *  lead — the row's `related_lead_id` is the answer, and the caller
 *  cross-tenant-guards by comparing `client_id` against the client the
 *  slug resolved to. We deliberately filter on direction='outbound': we
 *  only want rows WE minted to be reply-targetable. */
export async function findOutboundByThreadToken(
  threadToken: string,
): Promise<EmailMessageRow | null> {
  // The same thread token can appear on multiple outbound rows if an
  // operator sends several replies on the same lead (each reply mints a
  // fresh token in V1, but a future "single conversation token" model
  // could reuse one). Order newest-first so the most recent send wins.
  const { data, error } = await getIntegrationDb()
    .from(TABLE)
    .select(COLUMNS)
    .eq('thread_token', threadToken)
    .eq('direction', 'outbound')
    .order('occurred_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`findOutboundByThreadToken: ${error.message}`);
  return (data as EmailMessageRow | null) ?? null;
}

/** The conversation thread for one lead — every email_messages row,
 *  chronological. The lead inbox UI reads through this. */
export async function listMessagesForLead(
  leadId: string,
): Promise<EmailMessageRow[]> {
  const { data, error } = await getIntegrationDb()
    .from(TABLE)
    .select(COLUMNS)
    .eq('related_lead_id', leadId)
    .order('occurred_at', { ascending: true });
  if (error) throw new Error(`listMessagesForLead: ${error.message}`);
  return (data as unknown as EmailMessageRow[] | null) ?? [];
}
