// =============================================================================
// Twilio SMS — shared types.
//
// Two kinds of type live here:
//   • The slices of Twilio API objects this integration reads. Twilio objects
//     are large; only the fields actually consumed are typed (defensively —
//     most optional, so a Twilio API shift cannot crash a handler).
//   • The row shapes for the three SMS tables (client_sms_senders extended by
//     0058, sms_messages 0059, sms_templates 0060). Those tables are not in
//     the generated Database type yet, so they are hand-written here — same
//     rationale as _shared/db-types.ts.
//
// Phase 7 Twilio SMS session.
// =============================================================================

import type { SegmentEncoding } from '@/lib/sms/character-validator';

// --- Twilio API object slices ------------------------------------------------

/** A Twilio Message resource (SM…) — the send response + status reads. */
export type TwilioMessageResource = {
  sid: string;
  /** Twilio's own status enum: accepted/queued/sending/sent/delivered/
   *  undelivered/failed/receiving/received. */
  status: string;
  num_segments?: string;
  error_code?: number | null;
  error_message?: string | null;
};

/** A Twilio Messaging Service AlphaSender resource — the alphanumeric sender
 *  registration. */
export type TwilioAlphaSenderResource = {
  sid: string;
  alpha_sender: string;
  capabilities?: string[];
};

// --- our row shapes ----------------------------------------------------------

/** client_sms_senders.status — the carrier-registration lifecycle.
 *
 *  Extended by migration 0102 to include:
 *    - `pending_registration` — auto-assign job enqueued; Twilio not yet
 *      called. Set by `enqueueSenderRegistration` before the background job
 *      runs.
 *    - `failed` — Twilio rejected the registration (auth 20003, malformed
 *      sender, service unavailable). The operator UI surfaces
 *      `last_failure_code` / `last_failure_message` so the operator can fix
 *      the underlying issue (typically credentials) and retry.
 */
export type SmsSenderStatus =
  | 'pending_registration'
  | 'pending_approval'
  | 'approved'
  | 'failed'
  | 'rejected'
  | 'suspended';

/** A client_sms_senders row (migrations 0050 + 0058 + 0102). */
export type ClientSmsSenderRow = {
  id: string;
  client_id: string;
  sender_id: string;
  registered_at: string;
  status: SmsSenderStatus;
  notes: string | null;
  twilio_registration_sid: string | null;
  /** Migration 0102 — the active twilio_register_sender_id job, when one is
   *  in flight. Null on the manual-operator path and once the lifecycle
   *  reaches a terminal status. */
  registration_job_id?: string | null;
  last_registration_attempt_at?: string | null;
  last_failure_code?: string | null;
  last_failure_message?: string | null;
};

/** sms_messages.status — the delivery lifecycle. */
export type SmsMessageStatus = 'queued' | 'sent' | 'delivered' | 'failed' | 'undelivered';

/** An sms_messages row (migration 0059). */
export type SmsMessageRow = {
  id: string;
  sent_at: string;
  client_id: string;
  sender_id: string;
  recipient_phone: string;
  message_body: string;
  segments_count: number;
  encoding: SegmentEncoding;
  twilio_message_sid: string | null;
  status: SmsMessageStatus;
  error_code: string | null;
  error_message: string | null;
  related_lead_id: string | null;
  cost_eur: number | null;
};

/** The insert shape for a new sms_messages row. */
export type SmsMessageInsert = {
  client_id: string;
  sender_id: string;
  recipient_phone: string;
  message_body: string;
  segments_count: number;
  encoding: SegmentEncoding;
  twilio_message_sid: string | null;
  status: SmsMessageStatus;
  error_code?: string | null;
  error_message?: string | null;
  related_lead_id?: string | null;
  cost_eur?: number | null;
};

// Phase 8 Session 2: the `sms_templates` table was dropped (migration 0079).
// SMS bodies now live inline on `automation_actions.action_config.body`.
// `SmsTemplateRow` is gone with the table; the matching `SmsTemplateKey`
// type alias still lives in `lib/sms/default-templates.ts` as a string union
// used for diagnostic labelling on jobs + audit rows.
