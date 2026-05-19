// =============================================================================
// signup/submit — writes prospect submissions to the `submit-signup` edge
// function. Cold traffic has no session, so the function runs verify_jwt=false
// and writes with the service role; the browser never touches the table.
// =============================================================================

import { supabase } from '@/lib/supabase/client';

import type { GuaranteeEstimate } from './guarantee';
import type { ContactDetails, SignupBrief } from './types';

export type SubmitLeadResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

type SubmitLeadInput = {
  brief: SignupBrief;
  contact: Partial<ContactDetails>;
  estimate: GuaranteeEstimate | null;
  baseLeads: number | null;
};

/** Inserts (or partially captures, for exit-intent) a prospect lead. */
export async function submitLead(
  input: SubmitLeadInput,
): Promise<SubmitLeadResult> {
  const { brief, contact, estimate, baseLeads } = input;

  const { data, error } = await supabase.functions.invoke('submit-signup', {
    body: {
      action: 'lead',
      trade: brief.trade,
      serviceArea: brief.serviceArea,
      businessName: brief.businessName || null,
      mainService: brief.mainService || null,
      brandColors: brief.brandColors,
      contactName: contact.name || null,
      contactEmail: contact.email,
      contactPhone: contact.phone || null,
      guaranteedLeads: estimate?.leads ?? null,
      baseLeadsEstimate: baseLeads,
      adSpendMin: estimate?.adSpendMin ?? null,
      adSpendMax: estimate?.adSpendMax ?? null,
    },
  });

  if (error) return { ok: false, error: error.message };
  if (!data || data.error || !data.id) {
    return { ok: false, error: String(data?.error ?? 'submission_failed') };
  }
  return { ok: true, id: String(data.id) };
}

/** Marks a captured prospect as having completed the final CTA. Best-effort —
 *  a failure here must not block the confirmation screen. */
export async function completeSignup(id: string): Promise<void> {
  try {
    await supabase.functions.invoke('submit-signup', {
      body: { action: 'complete', id },
    });
  } catch {
    // Swallow — the lead is already captured; "complete" is just enrichment.
  }
}
