// =============================================================================
// Twilio SMS — job type constant + payload shape.
//
// Kept in a tiny standalone module so a caller (the public form-submit route)
// can enqueue a send_sms job by its type WITHOUT importing job-handlers.ts —
// which would pull the Twilio client + DB graph and run registerJobHandler in
// the caller's process. job-handlers.ts and the job executor import this same
// constant.
// =============================================================================

/** The job type for an outbound SMS send. */
export const SEND_SMS_JOB = 'send_sms';

/** Payload for a SEND_SMS_JOB.
 *
 * Phase 8 Session 2: `body` is now required. Bodies live on the originating
 * `automation_actions.action_config.body` (or are supplied directly by ad-hoc
 * callers like the GBP manual review-request route). The `sms_templates`
 * table is gone — there is no fallback lookup. The handler renders {{var}}
 * placeholders against a context built from clientId / relatedLeadId;
 * contextOverrides force or supply any variable the handler cannot derive
 * (job.*, review.link).
 *
 * `templateKey` is kept as a free-text label for diagnostics + the GBP audit
 * branch (which keys on `writes_gbp_review_request_audit` on action_config,
 * not on the key itself). It is no longer a lookup key. */
export type SendSmsPayload = {
  clientId: string;
  /** The pre-rendered SMS body template (with {{var}} placeholders). */
  body: string;
  /** Free-text label retained for the integration_call_log / debugging. */
  templateKey?: string;
  /** The recipient phone — freeform; normalised to E.164 by the handler. */
  recipientPhone: string;
  /** The lead this SMS is about, when applicable (lead acknowledgment). */
  relatedLeadId?: string | null;
  /** Variable overrides merged over the handler-built render context. */
  contextOverrides?: Record<string, string>;
};
