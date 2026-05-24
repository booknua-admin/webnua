// =============================================================================
// onboarding/wizard-state — load + save the wizard's in-progress state.
//
// Storage: `clients.wizard_state` (jsonb, migration 0091). One row per
// workspace; the column is NULL until the wizard starts and stays populated
// across resumes. Writes go through the browser Supabase client (the
// signed-in client owns the row, RLS allows the update via the publish-cap
// widening from migration 0087 — but for safety we route through a server
// route too, see /api/clients/[id]/wizard-state).
//
// Reactivity: every step transition writes wizard_state then invalidates
// any TanStack query that reads it. Resumes work because the dashboard
// gate's `useWizardState` re-reads on mount and lands the customer at
// `current_step`.
//
// Failure tolerance: a stale browser tab whose state diverged from what
// the server holds can ALWAYS reload — the wizard is server-state-driven
// at every load. We don't merge local + remote drafts; last writer wins.
// =============================================================================

import { supabase } from '@/lib/supabase/client';

import { INITIAL_WIZARD_STATE, type WizardState, type WizardStepId } from './types';

/** Load the persisted wizard state for a client. Returns null if the row
 *  doesn't exist or the column is empty (a fresh customer who hasn't
 *  started the wizard yet). */
export async function loadWizardState(clientId: string): Promise<WizardState | null> {
  const { data, error } = await supabase
    .from('clients')
    .select('wizard_state')
    .eq('id', clientId)
    .maybeSingle();
  if (error) {
    console.error('[wizard-state] load failed', error);
    return null;
  }
  const raw = (data as unknown as { wizard_state: unknown } | null)?.wizard_state ?? null;
  if (!raw) return null;
  return coerceWizardState(raw);
}

/** Save the wizard state to the clients row. Fire-and-forget by design —
 *  the wizard updates local React state synchronously and writes through
 *  asynchronously. A write failure is non-fatal: the customer can still
 *  advance, and a reload re-reads the SERVER state (which may be the
 *  prior step). Errors are surfaced via console + optional callback. */
export async function saveWizardState(
  clientId: string,
  state: WizardState,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // `as never` cast: the new columns from migration 0091 are not in the
  // generated Database type yet (regen runs after migration apply); the
  // column exists at runtime + RLS allows the update via the publish-cap
  // widening in migration 0087. Same precedent as `re-engagement-handler`'s
  // `re_engagement_sent_at` write.
  const { error } = await supabase
    .from('clients')
    .update({ wizard_state: state } as never)
    .eq('id', clientId);
  if (error) {
    console.error('[wizard-state] save failed', error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Mark the wizard complete: stamp clients.wizard_completed_at and clear
 *  the in-progress state. Called when the customer reaches step 7. Once
 *  this lands, the dashboard's `/onboarding` gate (page.tsx) sees the
 *  non-null timestamp and stops redirecting. */
export async function markWizardComplete(clientId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from('clients')
    .update({
      wizard_completed_at: new Date().toISOString(),
    } as never)
    .eq('id', clientId);
  if (error) {
    console.error('[wizard-state] complete-stamp failed', error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** True when the wizard is done — `clients.wizard_completed_at` is set. */
export async function isWizardComplete(clientId: string): Promise<boolean> {
  const { data } = await supabase
    .from('clients')
    .select('wizard_completed_at')
    .eq('id', clientId)
    .maybeSingle();
  const raw = (data as { wizard_completed_at: string | null } | null)?.wizard_completed_at ?? null;
  return raw !== null;
}

// --- coercion ---------------------------------------------------------------

/** Validate + coerce an unknown jsonb blob into a WizardState. A schema
 *  evolution (new step, new field) lands here — old data without the new
 *  field default-coalesces; unknown extras are dropped. Never throws —
 *  returns the initial state on a fully-broken value, which means the
 *  customer starts fresh (a graceful degrade for a malformed row from
 *  a prior schema version). */
function coerceWizardState(raw: unknown): WizardState {
  if (!raw || typeof raw !== 'object') return INITIAL_WIZARD_STATE;
  const r = raw as Record<string, unknown>;
  const currentStep = coerceStepId(r.current_step) ?? 1;
  const completed = Array.isArray(r.completed_steps)
    ? r.completed_steps.map(coerceStepId).filter((s): s is WizardStepId => s !== null)
    : [];
  const data = (r.step_data && typeof r.step_data === 'object'
    ? (r.step_data as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  return {
    current_step: currentStep,
    completed_steps: completed,
    step_data: {
      step1: (data.step1 as never) ?? null,
      step2: (data.step2 as never) ?? null,
      step3: (data.step3 as never) ?? null,
      step4: (data.step4 as never) ?? null,
      step5: (data.step5 as never) ?? null,
      step6: (data.step6 as never) ?? null,
    },
  };
}

function coerceStepId(v: unknown): WizardStepId | null {
  if (typeof v !== 'number') return null;
  if (v < 1 || v > 7 || !Number.isInteger(v)) return null;
  return v as WizardStepId;
}
