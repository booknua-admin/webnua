// =============================================================================
// Automation engine — job-type constants (Phase 8 Session 1).
//
// Three new job types route through the existing integration_jobs spine:
//
//   • automation_trigger — enqueued by the DB triggers (and onTrigger calls
//                          from server code). Payload carries the trigger
//                          type + the trigger_event. Handler resolves
//                          matching automations and creates runs.
//   • automation_action  — enqueued by the engine for each step of a run.
//                          Handler does the pre-flight handoff check, runs
//                          the action, then schedules the next.
//   • cold_lead_scan     — enqueued daily by pg_cron, one per enabled
//                          cold_lead_nudge automation. Handler scans leads
//                          and fires lead_inactive triggers.
// =============================================================================

export const AUTOMATION_TRIGGER_JOB = 'automation_trigger';
export const AUTOMATION_ACTION_JOB = 'automation_action';
export const COLD_LEAD_SCAN_JOB = 'cold_lead_scan';

// --- payload shapes --------------------------------------------------------

export type AutomationTriggerJobPayload = {
  clientId: string;
  triggerType: string; // AutomationTriggerType but accepts wider input
  triggerEvent: Record<string, unknown>;
};

export type AutomationActionJobPayload = {
  runId: string;
};

export type ColdLeadScanJobPayload = {
  clientId: string;
  automationId: string;
};
