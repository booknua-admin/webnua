// =============================================================================
// Automation action lookup helpers — Phase 8 Session 2.
//
// Server-only helpers for resolving the current `action_config` of a client's
// named automation action. The two manual review-request paths (the operator
// "Send review request" button in /api/integrations/google_business_profile/
// review-request and any future similar admin-triggered re-send) need this so
// a manual send honours the per-client edited body the operator + client see
// in the Session 2 automation editor — not a stale code default.
//
// The function reads regardless of `is_enabled` so a manual send still works
// when the automation has been paused (the operator wouldn't expect "Send
// review request" to be silently a no-op because they toggled the automation
// off). Honoring the disabled flag is the caller's choice.
// =============================================================================

import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';

export type AutomationActionConfigResult = {
  config: Record<string, unknown>;
  isEnabled: boolean;
  automationId: string;
  actionId: string;
};

/** Look up the live action_config for a client's named automation action.
 *
 *  @param clientId      The client whose automation we're reading.
 *  @param automationKey The `automation_key` (e.g. `'review_request'` —
 *                       PR B.3 consolidation collapsed `_sms` / `_email`
 *                       suffixed keys into multi-action automations).
 *  @param position      1-indexed action position. Multi-action automations
 *                       (lead_acknowledgment SMS pos1 + email pos2;
 *                       review_request SMS pos1 + email pos2) use this to
 *                       distinguish channels; single-action automations
 *                       default to 1. */
export async function getAutomationActionConfig(
  clientId: string,
  automationKey: string,
  position = 1,
): Promise<AutomationActionConfigResult | null> {
  const db = getIntegrationDb();
  const { data, error } = await db
    .from('automations')
    .select(
      'id, is_enabled, automation_actions(id, position, action_config)',
    )
    .eq('client_id', clientId)
    .eq('automation_key', automationKey)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as {
    id: string;
    is_enabled: boolean;
    automation_actions: Array<{ id: string; position: number; action_config: Record<string, unknown> | null }>;
  };
  const action = row.automation_actions.find((a) => a.position === position);
  if (!action) return null;
  return {
    config: action.action_config ?? {},
    isEnabled: row.is_enabled,
    automationId: row.id,
    actionId: action.id,
  };
}
