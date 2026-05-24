// =============================================================================
// Action handler — wait_for_duration (Phase 8 Session 1).
//
// Returns a `wait` outcome with the configured delayMs. The engine uses it
// to schedule the NEXT action with run_after = now() + delay, instead of
// dispatching immediately. No work is done in this handler beyond returning
// the delay; the wait itself is the integration_jobs run_after.
// =============================================================================

import type { ActionContext, ActionOutcome } from './dispatch';
import type { WaitActionConfig } from '../engine-types';

export async function runWaitForDuration(ctx: ActionContext): Promise<ActionOutcome> {
  const cfg = ctx.action.action_config as WaitActionConfig;
  const minutes = Number(cfg.minutes);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return { kind: 'skipped', reason: 'invalid_wait_minutes' };
  }
  return { kind: 'wait', delayMs: minutes * 60_000 };
}
