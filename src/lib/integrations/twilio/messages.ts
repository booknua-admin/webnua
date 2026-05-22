// =============================================================================
// Twilio SMS — sms_messages data access.
//
// Phase 7 Twilio SMS session. The send log: the send_sms job inserts a row
// per send; the Twilio status-callback webhook updates the row's status as
// delivery is reported. sms_messages is not in the generated Database type
// yet, so this reaches it through getIntegrationDb().
//
// SERVER-ONLY.
// =============================================================================

import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';

import type { SmsMessageInsert, SmsMessageRow, SmsMessageStatus } from './types';

const TABLE = 'sms_messages';
const COLUMNS =
  'id, sent_at, client_id, sender_id, recipient_phone, message_body, ' +
  'segments_count, encoding, twilio_message_sid, status, error_code, ' +
  'error_message, related_lead_id, cost_eur';

/** Insert one send-log row. */
export async function insertSmsMessage(insert: SmsMessageInsert): Promise<SmsMessageRow> {
  const { data, error } = await getIntegrationDb()
    .from(TABLE)
    .insert({
      client_id: insert.client_id,
      sender_id: insert.sender_id,
      recipient_phone: insert.recipient_phone,
      message_body: insert.message_body,
      segments_count: insert.segments_count,
      encoding: insert.encoding,
      twilio_message_sid: insert.twilio_message_sid,
      status: insert.status,
      error_code: insert.error_code ?? null,
      error_message: insert.error_message ?? null,
      related_lead_id: insert.related_lead_id ?? null,
      cost_eur: insert.cost_eur ?? null,
    })
    .select(COLUMNS)
    .single();
  if (error || !data) {
    throw new Error(`insertSmsMessage: ${error?.message ?? 'no row returned'}`);
  }
  return data as unknown as SmsMessageRow;
}

export type StatusUpdate = {
  status: SmsMessageStatus;
  errorCode?: string | null;
  errorMessage?: string | null;
};

/**
 * Update a message row's delivery status, found by its Twilio message SID.
 * Returns the resolved client_id (for call-log attribution) or null when no
 * row matches the SID — a status callback for a message we did not send.
 */
export async function updateStatusByTwilioSid(
  twilioSid: string,
  update: StatusUpdate,
): Promise<{ updated: boolean; clientId: string | null }> {
  const db = getIntegrationDb();
  const patch: Record<string, unknown> = { status: update.status };
  if (update.errorCode !== undefined) patch.error_code = update.errorCode;
  if (update.errorMessage !== undefined) patch.error_message = update.errorMessage;

  const { data, error } = await db
    .from(TABLE)
    .update(patch)
    .eq('twilio_message_sid', twilioSid)
    .select('client_id');
  if (error) throw new Error(`updateStatusByTwilioSid: ${error.message}`);
  const rows = (data as { client_id: string }[] | null) ?? [];
  if (rows.length === 0) return { updated: false, clientId: null };
  return { updated: true, clientId: rows[0].client_id };
}
