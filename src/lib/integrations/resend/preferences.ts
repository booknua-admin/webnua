// =============================================================================
// Resend email — notification_preferences data access.
//
// Phase 7 Resend session. The send_lead_notification job reads recipients
// here; the operator settings UI reads + writes through this module.
// notification_preferences (0063) is not in the generated Database type yet.
//
// SERVER-ONLY.
// =============================================================================

import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';

import type {
  DigestFrequency,
  NotificationPreferenceInsert,
  NotificationPreferenceRow,
} from './types';

const TABLE = 'notification_preferences';
const COLUMNS =
  'id, client_id, operator_email, notify_on_new_lead, ' +
  'notify_on_payment_failure, notify_on_review_received, ' +
  'digest_frequency, created_at, updated_at';

/** Every preference row for one client — feeds the settings UI list. */
export async function listPreferencesForClient(
  clientId: string,
): Promise<NotificationPreferenceRow[]> {
  const { data, error } = await getIntegrationDb()
    .from(TABLE)
    .select(COLUMNS)
    .eq('client_id', clientId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`listPreferencesForClient: ${error.message}`);
  return (data as unknown as NotificationPreferenceRow[] | null) ?? [];
}

/** Recipients to notify when a new lead lands on the given client. */
export async function listNewLeadRecipients(
  clientId: string,
): Promise<NotificationPreferenceRow[]> {
  const { data, error } = await getIntegrationDb()
    .from(TABLE)
    .select(COLUMNS)
    .eq('client_id', clientId)
    .eq('notify_on_new_lead', true);
  if (error) throw new Error(`listNewLeadRecipients: ${error.message}`);
  return (data as unknown as NotificationPreferenceRow[] | null) ?? [];
}

export async function insertPreference(
  input: NotificationPreferenceInsert,
): Promise<NotificationPreferenceRow> {
  const { data, error } = await getIntegrationDb()
    .from(TABLE)
    .insert({
      client_id: input.client_id,
      operator_email: input.operator_email,
      notify_on_new_lead: input.notify_on_new_lead ?? true,
      notify_on_payment_failure: input.notify_on_payment_failure ?? true,
      notify_on_review_received: input.notify_on_review_received ?? true,
      digest_frequency: input.digest_frequency ?? 'immediate',
    })
    .select(COLUMNS)
    .single();
  if (error || !data) {
    throw new Error(`insertPreference: ${error?.message ?? 'no row returned'}`);
  }
  return data as unknown as NotificationPreferenceRow;
}

export type UpdatePreferencePatch = {
  notify_on_new_lead?: boolean;
  notify_on_payment_failure?: boolean;
  notify_on_review_received?: boolean;
  digest_frequency?: DigestFrequency;
};

export async function updatePreference(
  id: string,
  patch: UpdatePreferencePatch,
): Promise<NotificationPreferenceRow> {
  const update: Record<string, unknown> = {};
  if (patch.notify_on_new_lead !== undefined) update.notify_on_new_lead = patch.notify_on_new_lead;
  if (patch.notify_on_payment_failure !== undefined) {
    update.notify_on_payment_failure = patch.notify_on_payment_failure;
  }
  if (patch.notify_on_review_received !== undefined) {
    update.notify_on_review_received = patch.notify_on_review_received;
  }
  if (patch.digest_frequency !== undefined) update.digest_frequency = patch.digest_frequency;
  const { data, error } = await getIntegrationDb()
    .from(TABLE)
    .update(update)
    .eq('id', id)
    .select(COLUMNS)
    .single();
  if (error || !data) {
    throw new Error(`updatePreference: ${error?.message ?? 'no row returned'}`);
  }
  return data as unknown as NotificationPreferenceRow;
}

export async function deletePreference(id: string): Promise<void> {
  const { error } = await getIntegrationDb().from(TABLE).delete().eq('id', id);
  if (error) throw new Error(`deletePreference: ${error.message}`);
}

// =============================================================================
// notifications_outbound — the send log (migration 0053). The throttle
// query lives here too: how recently did we send this template to this
// recipient for this client?
// =============================================================================

const OUTBOUND_TABLE = 'notifications_outbound';

export async function lastSentAtForRecipient(
  clientId: string,
  recipientEmail: string,
  templateName: string,
): Promise<Date | null> {
  const { data, error } = await getIntegrationDb()
    .from(OUTBOUND_TABLE)
    .select('sent_at')
    .eq('client_id', clientId)
    .eq('recipient_email', recipientEmail)
    .eq('template_name', templateName)
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`lastSentAtForRecipient: ${error.message}`);
  const row = data as { sent_at: string } | null;
  if (!row) return null;
  const ts = new Date(row.sent_at);
  return Number.isFinite(ts.getTime()) ? ts : null;
}

export type NotificationsOutboundInsert = {
  clientId: string;
  recipientEmail: string;
  templateName: string;
  status: 'sent' | 'failed';
  resendMessageId: string | null;
  relatedLeadId?: string | null;
};

export async function insertNotificationOutbound(
  input: NotificationsOutboundInsert,
): Promise<void> {
  const { error } = await getIntegrationDb()
    .from(OUTBOUND_TABLE)
    .insert({
      client_id: input.clientId,
      recipient_email: input.recipientEmail,
      template_name: input.templateName,
      status: input.status,
      resend_message_id: input.resendMessageId,
      related_lead_id: input.relatedLeadId ?? null,
    });
  if (error) {
    console.warn('[resend/preferences] notifications_outbound insert failed', error.message);
  }
}
