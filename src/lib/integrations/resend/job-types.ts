// =============================================================================
// Resend email — job type constants + payload shapes.
//
// Phase 7 Resend session. Kept tiny so callers (the public form-submit
// route, the inbound-webhook reply route, the leads `useReplyToLead` route)
// can enqueue jobs WITHOUT importing job-handlers.ts (which would eagerly
// register handlers in the caller's process).
// =============================================================================

import type { EmailTemplateKey } from './types';

/** Send one transactional email (template-rendered). */
export const SEND_EMAIL_JOB = 'send_email';

export type SendEmailPayload = {
  clientId: string;
  templateKey: EmailTemplateKey;
  recipientEmail: string;
  recipientName?: string;
  relatedLeadId?: string | null;
  /** Override values for specific template variables. Merged over the auto-
   *  resolved render context. */
  contextOverrides?: Record<string, string>;
  /** The In-Reply-To header to set, when this send is itself a reply. */
  inReplyTo?: string | null;
  /** When set, an extra recipient list. The primary `to` stays the
   *  recipientEmail; CC keeps a copy visible. Used by the operator-reply
   *  path to optionally CC additional addresses (V1.1; currently unused). */
  cc?: string[];
  /** Attachments to forward through to Resend. */
  attachments?: {
    filename: string;
    content_type?: string;
    /** Base64-encoded content (Resend's `content` field). */
    content?: string;
    /** OR a public URL Resend fetches at send time (Resend's `path`
     *  field). */
    path?: string;
  }[];
  /** When set, the send_email handler records the row with `sent_by` = this
   *  user id so the inbox displays the operator's name. */
  sentByUserId?: string;
};

/** Operator notification email for a newly-created lead. The handler resolves
 *  the recipients from notification_preferences, runs the throttle, and
 *  either dispatches send_email jobs OR sets the lead's
 *  notification_pending_at flag so the hourly digest catches it. */
export const SEND_LEAD_NOTIFICATION_JOB = 'send_lead_notification';

export type SendLeadNotificationPayload = {
  clientId: string;
  leadId: string;
};

/** Hourly digest worker. Enqueued by the pg_cron schedule in 0063. */
export const BATCH_NOTIFICATION_DIGEST_JOB = 'batch_notification_digest';

export type BatchNotificationDigestPayload = Record<string, never>;

/** Operator-facing one-off "test notification" send from the settings UI. */
export const SEND_TEST_NOTIFICATION_JOB = 'send_test_notification';

export type SendTestNotificationPayload = {
  clientId: string;
  recipientEmail: string;
};

/** Throttle window for the immediate operator-notification path. Pulled out
 *  so the test runner / a future setting can override. */
export const NEW_LEAD_THROTTLE_MINUTES = 5;
