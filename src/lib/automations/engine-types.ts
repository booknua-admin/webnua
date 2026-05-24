// =============================================================================
// Automation engine — internal TypeScript shapes (Phase 8 Session 1).
//
// Distinct from `types.ts` which carries the UI-facing types the existing
// `/automations` page consumes. This module is the engine's wire shape — the
// row types from migration 0076 plus the trigger-event payload unions the
// engine handlers consume.
// =============================================================================

export type AutomationTriggerType =
  | 'lead_created'
  | 'job_completed'
  | 'payment_failed'
  | 'job_scheduled'
  | 'job_status_changed'
  | 'lead_inactive';

export type AutomationActionType =
  | 'send_sms_to_lead'
  | 'send_email_to_lead'
  | 'send_operator_notification'
  | 'wait_for_duration'
  | 'update_lead_field'
  | 'create_followup_task';

export type AutomationRunStatus =
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused';

export type AutomationPauseReason =
  | 'lead_replied'
  | 'client_took_over'
  | 'manually_cancelled';

export type LeadAutomationState = 'automated' | 'taken_over' | 'completed' | 'archived';

// --- table rows -------------------------------------------------------------

export type AutomationRow = {
  id: string;
  client_id: string;
  automation_key: string;
  name: string;
  description: string | null;
  is_enabled: boolean;
  is_default: boolean;
  trigger_type: AutomationTriggerType;
  trigger_config: Record<string, unknown>;
  trigger_filters: Record<string, unknown>;
  last_edited_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AutomationActionRow = {
  id: string;
  automation_id: string;
  position: number;
  action_type: AutomationActionType;
  action_config: Record<string, unknown>;
  pauses_on_human_activity: boolean;
  created_at: string;
  updated_at: string;
};

export type AutomationRunRow = {
  id: string;
  automation_id: string;
  client_id: string;
  lead_id: string | null;
  trigger_event: Record<string, unknown>;
  started_at: string;
  completed_at: string | null;
  paused_at: string | null;
  resumed_at: string | null;
  status: AutomationRunStatus;
  paused_reason: AutomationPauseReason | null;
  current_action_position: number;
  last_automation_message_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

// --- trigger event payloads ------------------------------------------------
// The shape of `trigger_event` jsonb per trigger type. Validated loosely at
// runtime — anything missing the engine treats as a skip.

export type LeadCreatedEvent = {
  leadId: string;
  customerId?: string | null;
  recipientName?: string | null;
  recipientPhone?: string | null;
};

export type JobScheduledEvent = {
  bookingId: string;
  leadId?: string | null;
  customerId?: string | null;
  recipientName?: string | null;
  recipientPhone?: string | null;
  recipientEmail?: string | null;
  startsAt?: string | null;
};

export type JobCompletedEvent = {
  bookingId: string;
  leadId?: string | null;
  customerId?: string | null;
  recipientName?: string | null;
  recipientPhone?: string | null;
  recipientEmail?: string | null;
};

export type JobStatusChangedEvent = {
  bookingId: string;
  leadId?: string | null;
  customerId?: string | null;
  recipientName?: string | null;
  recipientPhone?: string | null;
  fromStatus?: string;
  toStatus: string;
};

export type PaymentFailedEvent = {
  invoiceId?: string | null;
};

export type LeadInactiveEvent = {
  leadId: string;
  automationId?: string;
};

export type TriggerEventByType = {
  lead_created: LeadCreatedEvent;
  job_scheduled: JobScheduledEvent;
  job_completed: JobCompletedEvent;
  job_status_changed: JobStatusChangedEvent;
  payment_failed: PaymentFailedEvent;
  lead_inactive: LeadInactiveEvent;
};

// --- action config -------------------------------------------------------

export type SendSmsActionConfig = {
  template_key: string;
  writes_gbp_review_request_audit?: boolean;
};

export type SendEmailActionConfig = {
  template_key: string;
  writes_gbp_review_request_audit?: boolean;
};

export type OperatorNotificationActionConfig = {
  variant: 'new_lead' | 'payment_failed';
};

export type WaitActionConfig = {
  minutes: number;
};

export type UpdateLeadFieldActionConfig = {
  field: 'status' | 'urgency';
  value: string;
};

export type CreateFollowupTaskActionConfig = {
  hint?: string;
};

// --- which action types pause on human activity --------------------------
// Mirrors the DB constraint `pauses_on_human_activity` derivation. The
// engine uses this when deriving the flag for newly-inserted actions; the
// runtime pre-flight reads the flag column directly.
export const ACTION_PAUSES_ON_HUMAN_ACTIVITY: Readonly<Record<AutomationActionType, boolean>> = {
  send_sms_to_lead: true,
  send_email_to_lead: true,
  send_operator_notification: false,
  wait_for_duration: false,
  update_lead_field: false,
  create_followup_task: false,
};

// --- a thin lead snapshot the engine + action handlers share -------------
// Resolved once per run; sidesteps re-querying the lead for every action.
export type LeadSnapshot = {
  id: string;
  clientId: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  status: string;
  automationState: LeadAutomationState;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
};
