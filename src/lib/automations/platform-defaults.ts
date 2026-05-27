// =============================================================================
// Automation platform defaults — runtime source of truth for action bodies.
//
// This module is the in-code reflection of the bodies the DB seed function
// writes inline on `automation_actions.action_config.body` (+ `subject` for
// email actions). The function lives in migration 0109 (most recent —
// supersedes 0077 and the body-less 0105). The two must stay in lockstep:
// editing a body here without updating the SQL function (and vice versa)
// means a new client gets one body and an existing edit reverts to a
// different one.
//
// The runtime engine prefers `automation_actions.action_config.body` /
// `.subject` (per-client edits) over these defaults. These come into play
// for:
//   • A future "Reset to default" UI affordance.
//   • Operator-side preview when comparing edited copy to the original.
//   • Legacy rows where a backfill missed setting body (migration 0109
//     handles current rows; this is the in-code fallback).
//
// Bodies use the same `{{var}}` placeholders the template renderer resolves
// at send time (`lib/sms/template-renderer.ts`, `lib/email/templates.ts`).
//
// CONSOLIDATION NOTE (PR B.3 — migration 0105): the per-channel automations
// from the original 0077 seed (lead_acknowledgment_sms +
// lead_acknowledgment_email, review_request_sms + review_request_email) were
// collapsed into multi-action automations. The list below tracks the NEW
// consolidated shape — each multi-channel automation has two `actions`
// entries (SMS at position 1, email at position 2) instead of two separate
// automation entries.
// =============================================================================

import type { AutomationActionType } from './engine-types';

/**
 * Per-action default config. Keyed by automation_key + position (1-indexed).
 * Multi-action automations (lead_acknowledgment, review_request) carry one
 * entry per position; single-action automations carry just position 1.
 */
export type AutomationActionDefault = {
  position: number;
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
  /** Conditional-fire filters: only fire when the predicate holds. */
  requiresPhone?: boolean;
  requiresEmail?: boolean;
  requiresNoPhone?: boolean;
  requiresGbpLocation?: boolean;
  /** Delay (in minutes) before this action fires after the trigger. */
  delayMinutes?: number;
  /** Whether the action pauses if the customer replies. */
  pausesOnHumanActivity: boolean;
};

export type AutomationDefault = {
  automationKey: string;
  name: string;
  description: string;
  isEnabled: boolean;
  visibility: 'client' | 'platform_internal';
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

// --- the 7 platform defaults (5 client + 2 platform-internal) -----------------

export const PLATFORM_DEFAULT_AUTOMATIONS: readonly AutomationDefault[] = [
  {
    automationKey: 'lead_acknowledgment',
    name: 'Instant lead reply',
    description:
      'Fires the moment a new lead lands. Sends an SMS to leads with a phone on file and a follow-up email to leads with an email on file.',
    isEnabled: true,
    visibility: 'client',
    triggerType: 'lead_created',
    actions: [
      {
        position: 1,
        actionType: 'send_sms_to_lead',
        templateKey: 'lead_acknowledgment',
        requiresPhone: true,
        pausesOnHumanActivity: true,
        body:
          'Hi {{lead.firstName}}, thanks for the enquiry — {{client.businessName}} here. ' +
          "I'll be in touch within {{client.responseTime}} to sort out {{lead.service}}. " +
          'Reply to this message if you need anything urgent.',
      },
      {
        position: 2,
        actionType: 'send_email_to_lead',
        templateKey: 'lead_followup',
        requiresEmail: true,
        pausesOnHumanActivity: true,
        subject: "Thanks for your enquiry — we'll be in touch shortly",
        body:
          'Hi {{lead.firstName}},\n\n' +
          'Thanks for getting in touch with {{client.businessName}}. ' +
          "I've seen your enquiry about {{lead.service}} and I'll reach out within {{client.responseTime}}.\n\n" +
          "If it's urgent, you can reach me directly on {{client.phone}}.\n\n" +
          '— {{client.businessName}}',
      },
    ],
  },
  {
    automationKey: 'cold_lead_nudge',
    name: 'Cold lead follow-up nudge',
    description:
      'Surfaces a lead with no inbound activity in 4 days as a follow-up task. You write the follow-up yourself.',
    isEnabled: true,
    visibility: 'client',
    triggerType: 'lead_inactive',
    triggerConfig: { days_after_last_outbound: 4, max_nudges: 3 },
    actions: [
      {
        position: 1,
        actionType: 'create_followup_task',
        pausesOnHumanActivity: true,
        hint: 'Lead has gone quiet — needs a personal nudge.',
      },
    ],
  },
  {
    automationKey: 'review_request',
    name: 'Review request',
    description:
      'Asks the lead to leave a Google review 2 hours after the job is marked complete. Sends SMS when a phone is on file, with email fallback otherwise. Only fires when a connected GBP location exists.',
    isEnabled: true,
    visibility: 'client',
    triggerType: 'job_completed',
    actions: [
      {
        position: 1,
        actionType: 'send_sms_to_lead',
        templateKey: 'review_request',
        requiresPhone: true,
        requiresGbpLocation: true,
        writesGbpReviewRequestAudit: true,
        delayMinutes: 120,
        pausesOnHumanActivity: true,
        body:
          'Hi {{lead.firstName}}, thanks for choosing {{client.businessName}}. ' +
          "If you've a minute, a quick Google review would mean a lot — {{review.link}}. Cheers!",
      },
      {
        position: 2,
        actionType: 'send_email_to_lead',
        templateKey: 'review_request',
        requiresEmail: true,
        requiresNoPhone: true,
        requiresGbpLocation: true,
        writesGbpReviewRequestAudit: true,
        delayMinutes: 120,
        pausesOnHumanActivity: true,
        subject: 'Quick favour — a Google review for {{client.businessName}}',
        body:
          'Hi {{lead.firstName}},\n\n' +
          "Thanks for choosing {{client.businessName}} — it's been a pleasure working with you.\n\n" +
          'If you have a minute, a quick Google review would mean the world:\n{{review.link}}\n\n' +
          'Cheers,\n{{client.businessName}}',
      },
    ],
  },
  {
    automationKey: 'booking_confirmation',
    name: 'Booking confirmation SMS',
    description:
      'Sends a booking confirmation SMS when a booking is created. Default off — opt in when you trust the cadence.',
    isEnabled: false,
    visibility: 'client',
    triggerType: 'job_scheduled',
    triggerFilters: { requires_phone: true },
    actions: [
      {
        position: 1,
        actionType: 'send_sms_to_lead',
        templateKey: 'job_confirmation',
        requiresPhone: true,
        pausesOnHumanActivity: true,
        body:
          'Hi {{lead.firstName}}, this is {{client.businessName}} confirming your booking ' +
          "on {{job.date}} at {{job.time}}. We'll be at {{job.address}}. Reply if anything changes.",
      },
    ],
  },
  {
    automationKey: 'arrival_notification',
    name: 'On the way SMS',
    description:
      'Sends an arrival or status-change notification when a booking flips to in-progress. Default off — opt in when you trust the cadence.',
    isEnabled: false,
    visibility: 'client',
    triggerType: 'job_status_changed',
    triggerConfig: { to_status: 'in_progress' },
    triggerFilters: { requires_phone: true },
    actions: [
      {
        position: 1,
        actionType: 'send_sms_to_lead',
        templateKey: 'arrival_notification',
        requiresPhone: true,
        pausesOnHumanActivity: true,
        body:
          "Hi {{lead.firstName}}, {{client.businessName}} here — we're on the way. " +
          'ETA {{job.eta}}. See you shortly!',
      },
    ],
  },
  {
    automationKey: 'operator_lead_notification',
    name: 'Operator new-lead notification',
    description:
      'Webnua-managed: notifies the recipients configured on /settings/notifications when a new lead arrives. Hidden from the client UI.',
    isEnabled: true,
    visibility: 'platform_internal',
    triggerType: 'lead_created',
    actions: [
      {
        position: 1,
        actionType: 'send_operator_notification',
        variant: 'new_lead',
        pausesOnHumanActivity: false,
      },
    ],
  },
  {
    automationKey: 'payment_failed_notification',
    name: 'Payment failed operator alert',
    description:
      'Webnua-managed: emails the operator when a Stripe subscription payment fails. Hidden from the client UI.',
    isEnabled: true,
    visibility: 'platform_internal',
    triggerType: 'payment_failed',
    actions: [
      {
        position: 1,
        actionType: 'send_operator_notification',
        variant: 'payment_failed',
        pausesOnHumanActivity: false,
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

/** Lookup one action by (automation_key, position). Returns undefined when
 *  the key isn't a default OR the position is out of range. Used by the
 *  "Reset to default" affordance to restore a single action's body. */
export function getPlatformDefaultAction(
  automationKey: string,
  position: number,
): AutomationActionDefault | undefined {
  return getPlatformDefault(automationKey)?.actions.find((a) => a.position === position);
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
  if (def.requiresPhone) cfg.requires_phone = true;
  if (def.requiresEmail) cfg.requires_email = true;
  if (def.requiresNoPhone) cfg.requires_no_phone = true;
  if (def.requiresGbpLocation) cfg.requires_gbp_location = true;
  if (def.delayMinutes !== undefined) cfg.delay_minutes = def.delayMinutes;
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
