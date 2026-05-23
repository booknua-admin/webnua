// =============================================================================
// Resend email integration — shared types.
//
// Two kinds of type live here:
//   • Slices of the Resend API objects this integration reads. Resend
//     response shapes are large; only the fields actually consumed are typed
//     (defensively — most optional, so an API shift cannot crash a handler).
//   • Row shapes for the four email tables (client_email_senders 0051,
//     email_messages 0061, email_templates 0062, notification_preferences
//     0063). Those tables are not in the generated Database type yet, so they
//     are hand-written here — same rationale as _shared/db-types.ts.
//
// Phase 7 Resend session.
// =============================================================================

// --- Resend API object slices ------------------------------------------------

/** Resend's response to POST /emails — `id` is the message id (re_…). */
export type ResendSendResponse = {
  id: string;
};

/** Resend's response to GET /emails/{id} — defensive subset. Resend uses
 *  the same endpoint for outbound + inbound, so the body fields are
 *  populated for inbound retrievals even when the `email.received` webhook
 *  itself omitted them. */
export type ResendMessageResource = {
  id: string;
  /** delivered / bounced / complained / sent / queued / etc. */
  last_event?: string;
  to?: string[] | string;
  from?: string;
  subject?: string;
  text?: string;
  html?: string;
  created_at?: string;
};

/** A normalised slice of an inbound email Resend's inbound webhook delivers.
 *  Resend's inbound payload varies by API version; this is the shape we
 *  extract from whatever they hand us. */
export type ResendInboundEmail = {
  /** Resend's id for this inbound delivery — for idempotency. */
  id?: string;
  from?: string;
  to?: string[] | string;
  subject?: string;
  text?: string;
  html?: string;
  /** RFC 2822 Message-ID of the inbound email itself. */
  message_id?: string;
  /** RFC 2822 In-Reply-To header — links the reply to our outbound message. */
  in_reply_to?: string;
  /** Raw headers, as a flat record. Used for auto-responder detection. */
  headers?: Record<string, string>;
  attachments?: {
    filename?: string;
    content_type?: string;
    /** Base64-encoded content. We re-upload to Storage and drop the body. */
    content?: string;
  }[];
};

// --- our row shapes ----------------------------------------------------------

/** client_email_senders.status — V1: 'active' (sender slug provisioned, ready
 *  to send) or 'suspended' (paused). Same shape as migration 0051. */
export type EmailSenderStatus = 'active' | 'suspended';

/** A client_email_senders row (migration 0051). */
export type ClientEmailSenderRow = {
  id: string;
  client_id: string;
  /** The slug used as the local-part of the sending address — globally unique
   *  across all clients (`[a-z0-9-]{1,30}`). The actual From address is
   *  composed at send time: `{slug}@{EMAIL_SENDING_DOMAIN}`. */
  slug: string;
  /** Human-readable display name used in the From header. */
  display_name: string;
  status: EmailSenderStatus;
  /** Custom sending domain — V1.1, currently always NULL; the integration
   *  reads `slug@EMAIL_SENDING_DOMAIN`. */
  custom_domain: string | null;
  created_at: string;
};

/** email_messages.direction — outbound (we sent it) / inbound (a lead replied). */
export type EmailMessageDirection = 'outbound' | 'inbound';

/** email_messages.status — outbound delivery lifecycle + inbound 'received'. */
export type EmailMessageStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'bounced'
  | 'complained'
  | 'failed'
  | 'received';

/** A single email attachment, the shape we store on `email_messages.attachments`
 *  and the shape `FormBlock`-style inbox UI consumes back. `storage_path` is
 *  resolved to a signed URL at read time. */
export type EmailAttachment = {
  filename: string;
  content_type: string;
  /** Path under the email-attachments Storage bucket. */
  storage_path: string;
  /** Size in bytes, when known. */
  size_bytes?: number;
};

/** An email_messages row (migration 0061). */
export type EmailMessageRow = {
  id: string;
  occurred_at: string;
  client_id: string;
  direction: EmailMessageDirection;
  sender_address: string;
  recipient_address: string;
  reply_to_address: string | null;
  subject: string;
  body_text: string;
  body_html: string;
  resend_message_id: string | null;
  in_reply_to_message_id: string | null;
  status: EmailMessageStatus;
  related_lead_id: string | null;
  thread_token: string | null;
  attachments: EmailAttachment[];
  is_auto_responder: boolean;
  correlation_id: string | null;
  sent_by: string | null;
};

/** The insert shape for a new email_messages row. */
export type EmailMessageInsert = {
  client_id: string;
  direction: EmailMessageDirection;
  sender_address: string;
  recipient_address: string;
  reply_to_address?: string | null;
  subject?: string;
  body_text?: string;
  body_html?: string;
  resend_message_id?: string | null;
  in_reply_to_message_id?: string | null;
  status: EmailMessageStatus;
  related_lead_id?: string | null;
  thread_token?: string | null;
  attachments?: EmailAttachment[];
  is_auto_responder?: boolean;
  correlation_id?: string | null;
  sent_by?: string | null;
};

/** email_templates.template_key — the closed set of templates. New keys need
 *  a migration (and a code change), by design. */
export type EmailTemplateKey =
  | 'lead_followup'
  | 'review_request'
  | 'quote_followup'
  | 'lead_notification'
  | 'lead_digest';

/** An email_templates row (migration 0062). */
export type EmailTemplateRow = {
  id: string;
  client_id: string;
  template_key: EmailTemplateKey;
  subject: string;
  body_html: string;
  body_text: string;
  is_default: boolean;
  last_edited_at: string;
  last_edited_by: string | null;
  created_at: string;
};

/** notification_preferences.digest_frequency. */
export type DigestFrequency = 'immediate' | 'hourly' | 'daily';

/** A notification_preferences row (migration 0063). */
export type NotificationPreferenceRow = {
  id: string;
  client_id: string;
  operator_email: string;
  notify_on_new_lead: boolean;
  notify_on_payment_failure: boolean;
  notify_on_review_received: boolean;
  digest_frequency: DigestFrequency;
  created_at: string;
  updated_at: string;
};

/** The insert shape for a notification_preferences row. */
export type NotificationPreferenceInsert = {
  client_id: string;
  operator_email: string;
  notify_on_new_lead?: boolean;
  notify_on_payment_failure?: boolean;
  notify_on_review_received?: boolean;
  digest_frequency?: DigestFrequency;
};
