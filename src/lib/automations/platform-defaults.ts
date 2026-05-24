// =============================================================================
// Automation platform defaults — Phase 8 Session 2.
//
// Source of truth at runtime for the body / subject every default action
// ships with. This file is BOTH:
//   • The reference an operator can compare against when checking what the
//     platform default for a given automation_key is (the per-client edited
//     copy on action_config wins; this is what "Revert to default" would
//     restore to).
//   • The contract migration 0079's `seed_default_automations()` writes
//     verbatim. The SQL function carries the bodies inline (it cannot read
//     TS), so the two must stay in lockstep — same convention CLAUDE.md
//     already records for SMS/email template seeds vs `DEFAULT_SMS_TEMPLATES`
//     / `DEFAULT_EMAIL_TEMPLATES` (which this module replaces).
//
// The runtime engine prefers `automation_actions.action_config.body` /
// `.subject` (per-client) over these defaults. These come into play only when:
//   • An action was created before its body was set (legacy / partial seed).
//   • A future "Reset to default" UI action.
//
// All bodies use the same `{{var}}` placeholders the template renderer
// resolves at send time (`lib/sms/template-renderer.ts`, `lib/email/templates.ts`).
// =============================================================================

import type { AutomationActionType } from './engine-types';

/**
 * Per-action default config. Keyed by automation_key + position (1-indexed).
 * Most defaults have a single action at position 1; if a future default has
 * multiple actions, each position carries its own config.
 */
export type AutomationActionDefault = {
  actionType: AutomationActionType;
  templateKey?: string;
  /** SMS body OR email plain-text fallback. */
  body?: string;
  /** Email-only — the subject line. */
  subject?: string;
  /** Email-only — HTML body. */
  bodyHtml?: string;
  /** Email-only — plain-text body. */
  bodyText?: string;
  /** Operator-notification variant. */
  variant?: 'new_lead' | 'payment_failed';
  /** Update-lead-field config. */
  field?: 'status' | 'urgency';
  value?: string;
  /** wait_for_duration config. */
  minutes?: number;
  /** create_followup_task hint. */
  hint?: string;
  /** GBP review-request flag — surfaces the audit row write. */
  writesGbpReviewRequestAudit?: boolean;
};

export type AutomationDefault = {
  automationKey: string;
  name: string;
  description: string;
  isEnabled: boolean;
  triggerType:
    | 'lead_created'
    | 'job_completed'
    | 'payment_failed'
    | 'job_scheduled'
    | 'job_status_changed'
    | 'lead_inactive';
  triggerConfig?: Record<string, unknown>;
  triggerFilters?: Record<string, unknown>;
  actions: AutomationActionDefault[];
};

// --- the 9 platform defaults ------------------------------------------------

export const PLATFORM_DEFAULT_AUTOMATIONS: readonly AutomationDefault[] = [
  {
    automationKey: 'lead_acknowledgment_sms',
    name: 'Instant lead confirmation SMS',
    description:
      "Sends the moment a new lead lands. Only fires when a phone is on file.",
    isEnabled: true,
    triggerType: 'lead_created',
    triggerFilters: { requires_phone: true },
    actions: [
      {
        actionType: 'send_sms_to_lead',
        templateKey: 'lead_acknowledgment',
        body:
          "Hi {{lead.firstName}}, thanks for the enquiry — {{client.businessName}} here. " +
          "I'll be in touch within {{client.responseTime}} to sort out {{lead.service}}. " +
          'Reply to this message if you need anything urgent.',
      },
    ],
  },
  {
    automationKey: 'lead_acknowledgment_email',
    name: 'Lead follow-up email',
    description:
      "Sends a follow-up email when a new lead lands. Only fires when an email is on file.",
    isEnabled: true,
    triggerType: 'lead_created',
    triggerFilters: { requires_email: true },
    actions: [
      {
        actionType: 'send_email_to_lead',
        templateKey: 'lead_followup',
        subject: "Thanks for your enquiry — we'll be in touch shortly",
        bodyHtml:
          '<p>Hi {{lead.firstName}},</p>' +
          '<p>Thanks for getting in touch with {{client.businessName}}. ' +
          "I've seen your enquiry about {{lead.service}} and I'll reach out within {{client.responseTime}}.</p>" +
          "<p>If it's urgent, you can reach me directly on {{client.phone}}.</p>" +
          '<p>— {{client.businessName}}</p>',
        bodyText:
          'Hi {{lead.firstName}},\n\n' +
          'Thanks for getting in touch with {{client.businessName}}. ' +
          "I've seen your enquiry about {{lead.service}} and I'll reach out within {{client.responseTime}}.\n\n" +
          "If it's urgent, you can reach me directly on {{client.phone}}.\n\n" +
          '— {{client.businessName}}',
      },
    ],
  },
  {
    automationKey: 'operator_lead_notification',
    name: 'Operator new-lead notification',
    description:
      'Sends configured operators a new-lead notification. Honors per-operator throttle + digest frequency on notification_preferences.',
    isEnabled: true,
    triggerType: 'lead_created',
    actions: [
      {
        actionType: 'send_operator_notification',
        variant: 'new_lead',
      },
    ],
  },
  {
    automationKey: 'job_scheduled_confirmation_sms',
    name: 'Booking confirmation SMS',
    description: 'Sends a booking confirmation SMS when a booking is created.',
    isEnabled: false,
    triggerType: 'job_scheduled',
    triggerFilters: { requires_phone: true },
    actions: [
      {
        actionType: 'send_sms_to_lead',
        templateKey: 'job_confirmation',
        body:
          'Hi {{lead.firstName}}, this is {{client.businessName}} confirming your booking ' +
          "on {{job.date}} at {{job.time}}. We'll be at {{job.address}}. Reply if anything changes.",
      },
    ],
  },
  {
    automationKey: 'job_arrival_notification_sms',
    name: 'On the way SMS',
    description:
      'Sends an arrival notification when a booking is marked on_the_way.',
    isEnabled: false,
    triggerType: 'job_status_changed',
    triggerConfig: { to_status: 'on_the_way' },
    triggerFilters: { requires_phone: true },
    actions: [
      {
        actionType: 'send_sms_to_lead',
        templateKey: 'arrival_notification',
        body:
          "Hi {{lead.firstName}}, {{client.businessName}} here — we're on the way. " +
          'ETA {{job.eta}}. See you shortly!',
      },
    ],
  },
  {
    automationKey: 'review_request_sms',
    name: 'Review request SMS (2h after job)',
    description:
      'Asks the customer for a Google review 2 hours after the job is marked complete. Only fires when the customer has a phone and the client has a connected GBP location.',
    isEnabled: true,
    triggerType: 'job_completed',
    triggerConfig: { delay_minutes: 120 },
    triggerFilters: { requires_phone: true, requires_gbp_location: true },
    actions: [
      {
        actionType: 'send_sms_to_lead',
        templateKey: 'review_request',
        writesGbpReviewRequestAudit: true,
        body:
          'Hi {{lead.firstName}}, thanks for choosing {{client.businessName}}. ' +
          "If you've a minute, a quick Google review would mean a lot — {{review.link}}. Cheers!",
      },
    ],
  },
  {
    automationKey: 'review_request_email',
    name: 'Review request email (no-phone fallback)',
    description:
      'Asks the customer for a Google review 2 hours after the job is marked complete, via email. Only fires when the customer has no phone but does have an email, and the client has a connected GBP location.',
    isEnabled: true,
    triggerType: 'job_completed',
    triggerConfig: { delay_minutes: 120 },
    triggerFilters: {
      requires_no_phone: true,
      requires_email: true,
      requires_gbp_location: true,
    },
    actions: [
      {
        actionType: 'send_email_to_lead',
        templateKey: 'review_request',
        writesGbpReviewRequestAudit: true,
        subject: 'Quick favour — a Google review for {{client.businessName}}',
        bodyHtml:
          '<p>Hi {{lead.firstName}},</p>' +
          "<p>Thanks for choosing {{client.businessName}} — it's been a pleasure working with you.</p>" +
          '<p>If you have a minute, a quick Google review would mean the world: ' +
          '<a href="{{review.link}}">leave a review</a>.</p>' +
          '<p>Cheers,<br/>{{client.businessName}}</p>',
        bodyText:
          'Hi {{lead.firstName}},\n\n' +
          "Thanks for choosing {{client.businessName}} — it's been a pleasure working with you.\n\n" +
          'If you have a minute, a quick Google review would mean the world:\n{{review.link}}\n\n' +
          'Cheers,\n{{client.businessName}}',
      },
    ],
  },
  {
    automationKey: 'payment_failed_notification',
    name: 'Payment failed operator alert',
    description:
      'Emails the operator(s) when a Stripe subscription payment fails.',
    isEnabled: true,
    triggerType: 'payment_failed',
    actions: [
      {
        actionType: 'send_operator_notification',
        variant: 'payment_failed',
      },
    ],
  },
  {
    automationKey: 'cold_lead_nudge',
    name: 'Cold lead follow-up nudge',
    description:
      'Surfaces leads that have gone quiet (no inbound for 4+ days since the last outbound) as a follow-up task. Up to 3 nudges per lead. Never sends a message — the client writes the follow-up themselves.',
    isEnabled: true,
    triggerType: 'lead_inactive',
    triggerConfig: { days_after_last_outbound: 4, max_nudges: 3 },
    actions: [
      {
        actionType: 'create_followup_task',
        hint: 'Lead has gone quiet — needs a personal nudge.',
      },
    ],
  },
];

/** Lookup by automation_key. Returns undefined for non-default keys. */
export function getPlatformDefault(
  automationKey: string,
): AutomationDefault | undefined {
  return PLATFORM_DEFAULT_AUTOMATIONS.find(
    (d) => d.automationKey === automationKey,
  );
}

/** Convert an `AutomationActionDefault` to the jsonb shape stored on the
 *  `automation_actions.action_config` column. Used by "Reset to default". */
export function actionDefaultToConfig(
  def: AutomationActionDefault,
): Record<string, unknown> {
  const cfg: Record<string, unknown> = {};
  if (def.templateKey) cfg.template_key = def.templateKey;
  if (def.body !== undefined) cfg.body = def.body;
  if (def.subject !== undefined) cfg.subject = def.subject;
  if (def.bodyHtml !== undefined) cfg.body_html = def.bodyHtml;
  if (def.bodyText !== undefined) cfg.body_text = def.bodyText;
  if (def.variant) cfg.variant = def.variant;
  if (def.field) cfg.field = def.field;
  if (def.value !== undefined) cfg.value = def.value;
  if (def.minutes !== undefined) cfg.minutes = def.minutes;
  if (def.hint !== undefined) cfg.hint = def.hint;
  if (def.writesGbpReviewRequestAudit) {
    cfg.writes_gbp_review_request_audit = true;
  }
  return cfg;
}

// --- variable catalog -------------------------------------------------------
// The full set of {{placeholders}} the template renderer recognises, grouped
// for the operator-side variable picker. Reused by the editor's
// "Available variables" rail.

export type AutomationVariableGroup = {
  groupLabel: string;
  variables: Array<{
    code: string;
    description: string;
    /** Comma-separated typical value example, for the editor preview. */
    sample?: string;
  }>;
};

export const AUTOMATION_VARIABLE_CATALOG: readonly AutomationVariableGroup[] = [
  {
    groupLabel: 'Lead',
    variables: [
      { code: '{{lead.firstName}}', description: "Lead's first name", sample: 'Sarah' },
      { code: '{{lead.service}}', description: 'What the lead asked for', sample: 'a kitchen extension quote' },
    ],
  },
  {
    groupLabel: 'Client',
    variables: [
      { code: '{{client.businessName}}', description: 'Your business name', sample: 'Voltline Electrical' },
      { code: '{{client.shortName}}', description: 'The SMS sender id', sample: 'VOLTLINE' },
      { code: '{{client.phone}}', description: 'Your contact phone', sample: '+353 86 555 0123' },
      { code: '{{client.responseTime}}', description: 'Your response-time promise', sample: '1 hour' },
    ],
  },
  {
    groupLabel: 'Job',
    variables: [
      { code: '{{job.date}}', description: 'Booking date', sample: 'Mon 26 May' },
      { code: '{{job.time}}', description: 'Booking start time', sample: '9:00 AM' },
      { code: '{{job.address}}', description: 'Job address', sample: '12 Pearse St, Dublin' },
      { code: '{{job.eta}}', description: 'On-the-way ETA', sample: '15 minutes' },
    ],
  },
  {
    groupLabel: 'Reputation',
    variables: [
      { code: '{{review.link}}', description: 'Google review URL (auto-resolved)', sample: 'https://g.page/r/.../review' },
    ],
  },
];

/** Flat array — the editor exposes both grouped and flat views. */
export const AUTOMATION_VARIABLE_FLAT: readonly { code: string; description: string }[] =
  AUTOMATION_VARIABLE_CATALOG.flatMap((g) =>
    g.variables.map((v) => ({ code: v.code, description: v.description })),
  );
