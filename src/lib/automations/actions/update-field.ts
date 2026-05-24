// =============================================================================
// Action handler — update_lead_field (Phase 8 Session 1).
//
// Inline UPDATE on the lead. Allowed fields are an allowlist (no arbitrary
// column writes). Internal action — does NOT pause on human activity.
// =============================================================================

import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';

import type { ActionContext, ActionOutcome } from './dispatch';
import type { UpdateLeadFieldActionConfig } from '../engine-types';

const ALLOWED_FIELDS = new Set<UpdateLeadFieldActionConfig['field']>(['status', 'urgency']);

export async function runUpdateLeadField(ctx: ActionContext): Promise<ActionOutcome> {
  const cfg = ctx.action.action_config as UpdateLeadFieldActionConfig;
  if (!ctx.run.lead_id) return { kind: 'skipped', reason: 'no_lead_id' };
  if (!cfg.field || !ALLOWED_FIELDS.has(cfg.field)) {
    return { kind: 'skipped', reason: `bad_field:${String(cfg.field)}` };
  }
  if (typeof cfg.value !== 'string' || cfg.value.length === 0) {
    return { kind: 'skipped', reason: 'bad_value' };
  }
  const db = getIntegrationDb();
  await db.from('leads').update({ [cfg.field]: cfg.value }).eq('id', ctx.run.lead_id);
  return { kind: 'ok' };
}
