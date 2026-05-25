// =============================================================================
// /api/clients/[id]/wizard-state
//
// GET  — returns { completed: boolean, state: WizardState | null }. The
//        dashboard reads this on mount to decide whether to redirect a
//        pre-onboarded client to /onboarding. Cheap — one column read.
//
// POST — upserts the wizard state. Body: { state: WizardState }. Used by
//        every wizard step transition. The browser Supabase client could
//        do this directly (RLS allows owner UPDATE via the publish-cap
//        grant from migration 0087) but the route gives us:
//          - a single place for shape validation
//          - server-time stamping on completion (vs client-clock drift)
//          - a clean audit point if we want to write to integration_call_log
//
// POST also accepts { complete: true } to mark wizard_completed_at = now()
// alongside the state write.
//
// Auth: requireClientAccess — the customer for their own client; an
// operator (concierge) acting on the customer's behalf.
// =============================================================================

import { NextResponse } from 'next/server';

import { requireClientAccess } from '@/lib/integrations/_shared/operator-auth';
import { getServiceClient } from '@/lib/supabase/server';
import type { Step2Data, WizardState } from '@/lib/onboarding/types';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: clientId } = await params;
  if (!clientId) {
    return NextResponse.json({ error: 'missing-client-id' }, { status: 400 });
  }

  const auth = await requireClientAccess(request, clientId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const svc = getServiceClient();
  const { data, error } = await svc
    .from('clients')
    .select('wizard_state, wizard_completed_at')
    .eq('id', clientId)
    .single();
  if (error || !data) {
    return NextResponse.json({ error: 'client-not-found' }, { status: 404 });
  }

  const row = data as unknown as {
    wizard_state: unknown;
    wizard_completed_at: string | null;
  };
  return NextResponse.json({
    completed: row.wizard_completed_at !== null,
    state: (row.wizard_state as WizardState | null) ?? null,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: clientId } = await params;
  if (!clientId) {
    return NextResponse.json({ error: 'missing-client-id' }, { status: 400 });
  }

  const auth = await requireClientAccess(request, clientId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: { state?: WizardState; complete?: boolean };
  try {
    body = (await request.json()) as { state?: WizardState; complete?: boolean };
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  // Minimal shape validation — full coercion lives in lib/onboarding/
  // wizard-state.ts (which the dashboard's load path uses). For the write
  // we trust the structure (the wizard generated it) but refuse a
  // non-object so we don't write garbage.
  const state = body.state ?? null;
  if (state !== null && (typeof state !== 'object' || Array.isArray(state))) {
    return NextResponse.json({ error: 'invalid-state-shape' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (state !== null) update.wizard_state = state;
  if (body.complete === true) {
    update.wizard_completed_at = new Date().toISOString();
  }

  // Phase 2 parity fix — mirror Step 2 fields onto the `clients` columns
  // the concierge path (createClientWithGeneration) writes at insert time.
  // The wizard previously left clients.name / primary_contact_phone /
  // service_area at their signup-time defaults regardless of what the
  // customer entered on Step 2 — Step 2 only landed in the wizard_state
  // jsonb, so any surface reading the canonical clients columns (the
  // hub, /settings/profile, the sidebar workspace card, the public-site
  // resolver) saw stale data until the customer manually edited from
  // /settings/profile post-publish.
  //
  // Only mirror columns the clients schema actually carries (name, phone,
  // service_area). Step 2's `hours` + `address` fields live only in
  // wizard_state.step_data.step2 — the deriver picks them up from there.
  // Idempotent — re-POSTing the same state runs the same UPDATE; we filter
  // to only fields the customer actually supplied (a trimmed empty stays
  // null at the schema level — don't clobber a real value with empty).
  const step2 = extractStep2(state);
  if (step2) {
    if (step2.businessName) update.name = step2.businessName;
    if (step2.phone) update.primary_contact_phone = step2.phone;
    if (step2.serviceArea) update.service_area = step2.serviceArea;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true, noop: true });
  }

  const svc = getServiceClient();
  const { error } = await svc.from('clients').update(update as never).eq('id', clientId);
  if (error) {
    console.error(`[wizard-state] update failed for ${clientId}: ${error.message}`);
    return NextResponse.json({ error: 'update-failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// --- internals --------------------------------------------------------------

/** Extract Step 2 data from the wizard state, returning trimmed values for
 *  the three fields the clients table carries (businessName / phone /
 *  serviceArea). Returns null when step 2 was skipped (null slot) or when
 *  the state shape is wrong. Hours + address have no clients column and
 *  stay only in wizard_state.step_data.step2. */
function extractStep2(state: WizardState | null): {
  businessName: string;
  phone: string;
  serviceArea: string;
} | null {
  if (!state) return null;
  const slot = state.step_data?.step2;
  if (!slot || typeof slot !== 'object') return null;
  const s = slot as Partial<Step2Data>;
  return {
    businessName: typeof s.businessName === 'string' ? s.businessName.trim() : '',
    phone: typeof s.phone === 'string' ? s.phone.trim() : '',
    serviceArea: typeof s.serviceArea === 'string' ? s.serviceArea.trim() : '',
  };
}
