// =============================================================================
// Twilio SMS — job type constant + payload shape.
//
// Kept in a tiny standalone module so a caller (the public form-submit route)
// can enqueue a send_sms job by its type WITHOUT importing job-handlers.ts —
// which would pull the Twilio client + DB graph and run registerJobHandler in
// the caller's process. job-handlers.ts and the job executor import this same
// constant.
// =============================================================================

import type { SmsTemplateKey } from '@/lib/sms/default-templates';

/** The job type for an outbound SMS send. */
export const SEND_SMS_JOB = 'send_sms';

/** Payload for a SEND_SMS_JOB. The handler loads the template + builds the
 *  render context from clientId / relatedLeadId; contextOverrides force or
 *  supply any variable the handler cannot derive (job.* / review.link). */
export type SendSmsPayload = {
  clientId: string;
  templateKey: SmsTemplateKey;
  /** The recipient phone — freeform; normalised to E.164 by the handler. */
  recipientPhone: string;
  /** The lead this SMS is about, when applicable (lead acknowledgment). */
  relatedLeadId?: string | null;
  /** Variable overrides merged over the handler-built render context. */
  contextOverrides?: Record<string, string>;
};
