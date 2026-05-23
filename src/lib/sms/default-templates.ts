// =============================================================================
// SMS templates — the closed set of template keys + their default bodies.
//
// Four transactional moments, one template each. Every client is seeded with
// these defaults (migration 0060's trigger + backfill); an operator can then
// customise any of them per client through the SMS template editor.
//
// DEFAULT_SMS_TEMPLATES MUST stay in lockstep with the seed bodies in
// supabase/migrations/0060_sms_templates.sql — the migration seeds the rows,
// this constant is the runtime fallback the send_sms job uses if a template
// row is somehow absent. Editing a default message: change both.
//
// SERVER + CLIENT safe — pure data, no imports.
// =============================================================================

/** The closed set of SMS template keys. A new key needs a migration. */
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

/** Operator-facing label + description for each template key. */
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

/** The default body for each template key. Keep in lockstep with the
 *  seed bodies in migration 0060. */
export const DEFAULT_SMS_TEMPLATES: Record<SmsTemplateKey, string> = {
  lead_acknowledgment:
    'Hi {{lead.firstName}}, {{client.shortName}} here. Got your enquiry about ' +
    "{{lead.service}}. We'll be in touch within {{client.responseTime}}.",
  job_confirmation:
    '{{client.shortName}}: Confirming your appointment for {{job.date}} at ' +
    "{{job.time}}. We'll text when we're on the way.",
  arrival_notification:
    "{{client.shortName}}: We're on the way to {{job.address}}. ETA {{job.eta}}. " +
    'Any questions, ring {{client.phone}}.',
  review_request:
    'Hi {{lead.firstName}}, hope the work went well today. If you have 30 seconds, ' +
    'would you mind leaving a quick Google review? {{review.link}} Thanks - ' +
    '{{client.shortName}}.',
};

/** The hard maximum template body length — 2 GSM-7 segments. A template over
 *  this cannot be saved (the editor blocks it; the API route re-checks it). */
export const MAX_TEMPLATE_LENGTH = 320;
