// =============================================================================
// Automation engine — job-handler registrations (Phase 8 Session 1).
//
// Three handlers wired through the integration_jobs spine:
//
//   • automation_trigger — calls engine.onTrigger.
//   • automation_action  — calls engine.processNextAction.
//   • cold_lead_scan     — calls cold-lead-scanner.runColdLeadScan.
//
// Side-effect module — imported by the job-handler manifest at
// `src/lib/integrations/job-handler-manifest.ts` so the executor route's
// module graph picks up the registrations.
// =============================================================================

import { registerJobHandler } from '@/lib/integrations/_shared/jobs';

import { onTrigger, processNextAction } from './engine';
import { runColdLeadScan } from './cold-lead-scanner';
import {
  AUTOMATION_ACTION_JOB,
  AUTOMATION_TRIGGER_JOB,
  COLD_LEAD_SCAN_JOB,
  type AutomationActionJobPayload,
  type AutomationTriggerJobPayload,
  type ColdLeadScanJobPayload,
} from './job-types';
import type { AutomationTriggerType } from './engine-types';

const VALID_TRIGGERS = new Set<AutomationTriggerType>([
  'lead_created',
  'job_completed',
  'payment_failed',
  'job_scheduled',
  'job_status_changed',
  'lead_inactive',
]);

registerJobHandler(AUTOMATION_TRIGGER_JOB, async (payload) => {
  const { clientId, triggerType, triggerEvent } =
    (payload ?? {}) as AutomationTriggerJobPayload;
  if (!clientId || !triggerType) {
    throw new Error('automation_trigger: payload missing clientId or triggerType');
  }
  if (!VALID_TRIGGERS.has(triggerType as AutomationTriggerType)) {
    throw new Error(`automation_trigger: unknown triggerType "${triggerType}"`);
  }
  const result = await onTrigger(
    clientId,
    triggerType as AutomationTriggerType,
    triggerEvent ?? {},
  );
  return result;
});

registerJobHandler(AUTOMATION_ACTION_JOB, async (payload) => {
  const { runId } = (payload ?? {}) as AutomationActionJobPayload;
  if (!runId) {
    throw new Error('automation_action: payload missing runId');
  }
  const result = await processNextAction(runId);
  return result;
});

registerJobHandler(COLD_LEAD_SCAN_JOB, async (payload) => {
  const { clientId, automationId } = (payload ?? {}) as ColdLeadScanJobPayload;
  if (!clientId || !automationId) {
    throw new Error('cold_lead_scan: payload missing clientId or automationId');
  }
  const result = await runColdLeadScan(clientId, automationId);
  return result;
});
