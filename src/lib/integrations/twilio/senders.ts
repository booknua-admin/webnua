// =============================================================================
// Twilio SMS — client_sms_senders data access.
//
// Phase 7 Twilio SMS session. Every read/write of client_sms_senders (the
// per-client alphanumeric sender assignment + registration status) goes
// through here. The table is not in the generated Database type yet, so this
// reaches it through getIntegrationDb() (the untyped service-role client).
//
// SERVER-ONLY.
// =============================================================================

import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';

import type { ClientSmsSenderRow, SmsSenderStatus } from './types';

const TABLE = 'client_sms_senders';
const COLUMNS = 'id, client_id, sender_id, registered_at, status, notes, twilio_registration_sid';

/** The one sender row for a client, or null when none is assigned yet. */
export async function getSenderByClientId(clientId: string): Promise<ClientSmsSenderRow | null> {
  const { data, error } = await getIntegrationDb()
    .from(TABLE)
    .select(COLUMNS)
    .eq('client_id', clientId)
    .maybeSingle();
  if (error) throw new Error(`getSenderByClientId: ${error.message}`);
  return (data as ClientSmsSenderRow | null) ?? null;
}

export type InsertSenderInput = {
  clientId: string;
  senderId: string;
  status: SmsSenderStatus;
  twilioRegistrationSid: string | null;
  notes?: string | null;
};

/** Insert the sender row for a client (one per client — the unique constraint
 *  on client_id enforces it). */
export async function insertSender(input: InsertSenderInput): Promise<ClientSmsSenderRow> {
  const { data, error } = await getIntegrationDb()
    .from(TABLE)
    .insert({
      client_id: input.clientId,
      sender_id: input.senderId,
      status: input.status,
      twilio_registration_sid: input.twilioRegistrationSid,
      notes: input.notes ?? null,
    })
    .select(COLUMNS)
    .single();
  if (error || !data) {
    throw new Error(`insertSender: ${error?.message ?? 'no row returned'}`);
  }
  return data as unknown as ClientSmsSenderRow;
}

export type UpdateSenderPatch = {
  status?: SmsSenderStatus;
  notes?: string | null;
  twilioRegistrationSid?: string | null;
};

/** Patch a sender row by id. Returns the updated row. */
export async function updateSender(
  id: string,
  patch: UpdateSenderPatch,
): Promise<ClientSmsSenderRow> {
  const update: Record<string, unknown> = {};
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.notes !== undefined) update.notes = patch.notes;
  if (patch.twilioRegistrationSid !== undefined) {
    update.twilio_registration_sid = patch.twilioRegistrationSid;
  }
  const { data, error } = await getIntegrationDb()
    .from(TABLE)
    .update(update)
    .eq('id', id)
    .select(COLUMNS)
    .single();
  if (error || !data) {
    throw new Error(`updateSender: ${error?.message ?? 'no row returned'}`);
  }
  return data as unknown as ClientSmsSenderRow;
}
