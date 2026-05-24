// =============================================================================
// SMS template key vocabulary.
//
// Phase 8 Session 2: the `sms_templates` table was dropped (migration 0079).
// SMS bodies now live inline on `automation_actions.action_config.body`, with
// the platform defaults captured in `src/lib/automations/platform-defaults.ts`.
//
// This module is kept as the home for the closed `SmsTemplateKey` vocabulary
// — the small set of string keys the engine and observability logs use to
// label SMS sends ("this send corresponds to a lead_acknowledgment-style
// automation"). The keys outlive the table: the engine tags `action_config`
// with one of these so the integration_call_log and per-row diagnostics stay
// readable. A new key in this list is a deliberate expansion — the platform
// defaults + the editor variable picker key off this vocabulary.
//
// SERVER + CLIENT safe — pure data, no imports.
// =============================================================================

/** The closed set of SMS template keys. */
export const SMS_TEMPLATE_KEYS = [
  'lead_acknowledgment',
  'job_confirmation',
  'arrival_notification',
  'review_request',
] as const;

export type SmsTemplateKey = (typeof SMS_TEMPLATE_KEYS)[number];

/** True when `value` is one of the four known template keys. */
export function isSmsTemplateKey(value: unknown): value is SmsTemplateKey {
  return typeof value === 'string' && (SMS_TEMPLATE_KEYS as readonly string[]).includes(value);
}

/** Operator-facing label + description for each template key. Used by the
 *  Session 2 editor to title the SMS step inside a multi-action automation. */
export const SMS_TEMPLATE_META: Record<SmsTemplateKey, { label: string; description: string }> = {
  lead_acknowledgment: {
    label: 'Lead acknowledgment',
    description: 'Sent automatically within seconds of a new enquiry — the lead nurture promise.',
  },
  job_confirmation: {
    label: 'Job confirmation',
    description: 'Confirms a booked appointment date and time.',
  },
  arrival_notification: {
    label: 'Arrival notification',
    description: 'Tells the customer the team is on the way, with an ETA.',
  },
  review_request: {
    label: 'Review request',
    description: 'Asks a happy customer for a Google review after the job.',
  },
};

/** The hard maximum SMS template body length — 2 GSM-7 segments. The Session 2
 *  editor blocks save above this; the engine handler also re-checks at send. */
export const MAX_TEMPLATE_LENGTH = 320;
