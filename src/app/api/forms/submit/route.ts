// =============================================================================
// Public form submission — POST /api/forms/submit.
//
// A lead-capture form on a published website / funnel posts here. The route
// is PUBLIC (anonymous visitors) — the one place, alongside the renderer,
// that anon traffic reaches. It writes with the service-role client (RLS
// bypassing); all validation is done here in code.
//
// A submission becomes a real lead: a `customers` row + a `leads` row + the
// opening `form_submitted` `lead_events` entry. This mirrors the editor
// test-submit path (lib/leads/queries.tsx submitLead) so a public lead is
// indistinguishable from a test one — and the leads inbox, the dashboard
// funnel, and the new-lead notification trigger all light up with no extra
// wiring.
//
// Funnel cross-step linking: when an `existingLeadId` is supplied, the route
// APPENDS a second `form_submitted` event to that lead rather than creating a
// new one (closes analytics-audit §2 / the duplicate-lead bug). Cross-tenant
// guard — the referenced lead must belong to the same `clientId` posted in
// the body. Per-funnel guard — when a funnelId is also supplied AND the lead
// already carries a `source_funnel_id`, the two must match; a NULL funnel id
// on the lead is healed forward (set on this submission). Mirrors the
// editor-side `submitLead(existingLeadId)` branch in `lib/leads/queries.tsx`.
//
// Lead-identity propagation on cross-step append (FIX A): step 2 of a funnel
// captures phone + service address. Without explicit propagation those values
// would only land in `lead_events.payload` — operators inspecting the lead
// from the inbox would see no phone. The route reads phone + address from
// the fields' `leadRole` tags and `COALESCE`-updates `customers.phone` /
// `customers.address` and `leads.customer_phone_snapshot`. First-non-null
// wins (an operator-edited customer.phone is never clobbered by a stale form
// submit). New customer-attribute roles get added to FormFieldLeadRole and
// extracted here — never detected by regex / field-name heuristic.
//
// V1 limitations: image-field uploads are not handled here (the private
// lead-attachments bucket needs an authenticated upload) — an image field's
// filename is recorded, the file is not stored. Abuse (a script posting fake
// leads) is possible; clientId is verified to exist but there is no rate
// limit yet.
// =============================================================================

import { NextResponse } from 'next/server';

import { getServiceClient } from '@/lib/supabase/server';
import { clientIp, rateLimit } from '@/lib/public-site/rate-limit';

// Phase 8 Session 1 — the previous direct enqueues of send_sms /
// send_email / send_lead_notification are gone. The leads INSERT DB trigger
// (migration 0078) now fans an `automation_trigger` job; the engine fires
// the matching lead_acknowledgment / lead_followup / operator_notification
// automations. Observable behaviour unchanged (same templates, same
// gating).

const MAX_FIELDS = 60;

type IncomingField = {
  fieldId?: unknown;
  label?: unknown;
  type?: unknown;
  value?: unknown;
  leadRole?: unknown;
  imagePath?: unknown;
};

type CleanField = {
  fieldId: string;
  label: string;
  type: string;
  value: string;
  leadRole?: 'name' | 'email' | 'phone' | 'address' | 'service';
  imagePath?: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

function cleanField(raw: IncomingField): CleanField | null {
  if (typeof raw.label !== 'string' || typeof raw.type !== 'string') return null;
  const value = typeof raw.value === 'string' ? raw.value.slice(0, 5000) : '';
  const role =
    raw.leadRole === 'name' ||
    raw.leadRole === 'email' ||
    raw.leadRole === 'phone' ||
    raw.leadRole === 'address' ||
    raw.leadRole === 'service'
      ? raw.leadRole
      : undefined;
  return {
    fieldId: typeof raw.fieldId === 'string' ? raw.fieldId : '',
    label: raw.label.slice(0, 200),
    type: raw.type,
    value,
    leadRole: role,
    imagePath: typeof raw.imagePath === 'string' && raw.imagePath ? raw.imagePath : undefined,
  };
}

export async function POST(req: Request) {
  if (!rateLimit(`forms-submit:${clientIp(req)}`, 8, 60_000)) {
    return bad('Too many submissions — please wait a minute.', 429);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad('Invalid request body.');
  }

  const { clientId, surfaceKind, funnelId, source, fields, submissionId, existingLeadId } = (body ??
    {}) as {
    clientId?: unknown;
    surfaceKind?: unknown;
    funnelId?: unknown;
    source?: unknown;
    fields?: unknown;
    submissionId?: unknown;
    existingLeadId?: unknown;
  };

  if (typeof clientId !== 'string' || !UUID_RE.test(clientId)) {
    return bad('Missing or invalid client.');
  }
  // Lead-correlation id (visitor-tracking-design §8) — optional; the tracking
  // script's `form_submit` event carries the same id so the funnel's tracked
  // and source-of-truth submitted counts can be reconciled.
  const cleanSubmissionId =
    typeof submissionId === 'string' && UUID_RE.test(submissionId) ? submissionId : null;
  // Cross-step funnel linking — optional. When set, the route appends to the
  // referenced lead instead of inserting a new one. A malformed value rejects
  // explicitly (a caller who tried to link should know they failed, not get a
  // silent orphan lead).
  let cleanExistingLeadId: string | null = null;
  if (existingLeadId !== undefined && existingLeadId !== null) {
    if (typeof existingLeadId !== 'string' || !UUID_RE.test(existingLeadId)) {
      return bad('Invalid lead reference.');
    }
    cleanExistingLeadId = existingLeadId;
  }
  if (!Array.isArray(fields) || fields.length === 0) {
    return bad('No form fields submitted.');
  }
  if (fields.length > MAX_FIELDS) {
    return bad('Too many form fields.');
  }
  const cleanFields = (fields as IncomingField[])
    .map(cleanField)
    .filter((f): f is CleanField => f !== null);
  if (cleanFields.length === 0) return bad('No valid form fields.');

  const sourceLabel =
    typeof source === 'string' && source.trim() ? source.trim().slice(0, 120) : 'Website form';
  // Surface attribution — written to `leads.source_kind`. The constraint on
  // the column rejects anything else; default 'website' when the caller
  // omits the field (older clients).
  const cleanSourceKind: 'website' | 'funnel' = surfaceKind === 'funnel' ? 'funnel' : 'website';
  // Funnel-to-lead attribution — optional. Only persisted when the caller is
  // submitting from a funnel surface; a malformed value rejects explicitly
  // (a caller who tried to attribute should know they failed, not get a
  // silent NULL). For website submissions any funnelId is ignored.
  let cleanFunnelId: string | null = null;
  if (cleanSourceKind === 'funnel' && funnelId !== undefined && funnelId !== null) {
    if (typeof funnelId !== 'string' || !UUID_RE.test(funnelId)) {
      return bad('Invalid funnel reference.');
    }
    cleanFunnelId = funnelId;
  }

  const svc = getServiceClient();

  // Verify the client exists — a fabricated clientId is rejected.
  const { data: client } = await svc.from('clients').select('id').eq('id', clientId).maybeSingle();
  if (!client) return bad('Unknown client.', 404);

  // Cross-tenant guard on the funnel reference — same shape as the
  // existingLeadId check. A funnel referencing a different client is
  // rejected. Lead is then written with the attribution; the existing-lead
  // append branch below also propagates this funnelId.
  if (cleanFunnelId) {
    const { data: funnel } = await svc
      .from('funnels')
      .select('id, client_id')
      .eq('id', cleanFunnelId)
      .maybeSingle();
    if (!funnel || funnel.client_id !== clientId) {
      return bad('Unknown funnel reference.');
    }
  }

  // Cross-step path: append to an existing lead. Cross-tenant guard — the
  // lead must belong to the same client (a malicious caller can't update an
  // unrelated tenant's lead by injecting a guessed UUID). Per-funnel guard
  // (FIX D) — a lead created from Funnel A cannot be appended to from Funnel B;
  // a NULL source_funnel_id on the lead is healed forward (set to the current
  // funnelId). Lead-not-found / wrong-client / wrong-funnel all surface as a
  // generic 400 so none of them leak lead existence.
  if (cleanExistingLeadId) {
    const { data: existing } = await svc
      .from('leads')
      .select('id, client_id, customer_id, source_funnel_id, customer_phone_snapshot')
      .eq('id', cleanExistingLeadId)
      .maybeSingle();
    if (!existing || existing.client_id !== clientId) {
      return bad('Unknown lead reference.', 400);
    }
    // Per-funnel guard. A `cleanFunnelId` was already cross-tenant-checked
    // above; here we check it matches whatever this lead originally captured
    // (heal-forward when NULL — per the C3 V1 brief decision).
    const existingFunnelId =
      (existing as { source_funnel_id?: string | null }).source_funnel_id ?? null;
    if (cleanFunnelId && existingFunnelId && existingFunnelId !== cleanFunnelId) {
      return bad('Unknown lead reference.', 400);
    }
    if (cleanFunnelId && !existingFunnelId) {
      // Heal-forward — one-time write so the funnel attribution survives the
      // cross-step linking. Only updates when currently NULL; never overwrites
      // a prior funnel id (the `cleanFunnelId !== existingFunnelId` branch above
      // already rejected the conflict case).
      await svc
        .from('leads')
        .update({ source_funnel_id: cleanFunnelId } as unknown as never)
        .eq('id', existing.id);
    }

    // FIX A — propagate phone + service-address from the qualification form's
    // tagged fields onto the customer + lead snapshot, COALESCE-style. First
    // non-null wins so an operator-edited customer value isn't clobbered by a
    // stale follow-up submission.
    const fieldRole = (role: 'phone' | 'address') =>
      cleanFields.find((f) => f.leadRole === role)?.value.trim() || '';
    const phoneFromForm = fieldRole('phone');
    const addressFromForm = fieldRole('address');
    const existingCustomerId =
      (existing as { customer_id?: string | null }).customer_id ?? null;
    if (existingCustomerId && (phoneFromForm || addressFromForm)) {
      const { data: customerRow } = await svc
        .from('customers')
        .select('phone, address')
        .eq('id', existingCustomerId)
        .maybeSingle();
      const customerPatch: { phone?: string; address?: string } = {};
      if (phoneFromForm && !(customerRow?.phone ?? null)) {
        customerPatch.phone = phoneFromForm;
      }
      if (addressFromForm && !(customerRow?.address ?? null)) {
        customerPatch.address = addressFromForm;
      }
      if (Object.keys(customerPatch).length > 0) {
        await svc.from('customers').update(customerPatch).eq('id', existingCustomerId);
      }
    }
    if (
      phoneFromForm &&
      !((existing as { customer_phone_snapshot?: string | null }).customer_phone_snapshot ?? null)
    ) {
      await svc
        .from('leads')
        .update({ customer_phone_snapshot: phoneFromForm } as unknown as never)
        .eq('id', existing.id);
    }

    const { error: eventError } = await svc.from('lead_events').insert({
      lead_id: existing.id,
      kind: 'form_submitted',
      occurred_at: new Date().toISOString(),
      actor_user_id: null,
      payload: {
        source: sourceLabel,
        submissionId: cleanSubmissionId,
        // `leadRole` round-trips so the automation render-context resolver
        // can prefer the tag over a label-regex match (`{{lead.service}}`).
        fields: cleanFields.map((f) => ({
          label: f.label,
          value: f.value,
          type: f.type,
          ...(f.leadRole ? { leadRole: f.leadRole } : {}),
        })),
        attachments: cleanFields
          .filter((f) => !!f.imagePath)
          .map((f) => ({
            fieldId: f.fieldId,
            label: f.label,
            path: f.imagePath,
          })),
      },
    });
    if (eventError) return bad('Could not record the submission.', 500);
    return NextResponse.json({ ok: true, leadId: existing.id });
  }

  // Resolve the lead identity from the leadRole-tagged fields.
  const roleValue = (role: 'name' | 'email' | 'phone') =>
    cleanFields.find((f) => f.leadRole === role)?.value.trim() || '';
  const name = roleValue('name') || 'Website enquiry';
  const email = roleValue('email') || null;
  const phone = roleValue('phone') || null;

  const { data: customer, error: customerError } = await svc
    .from('customers')
    .insert({ client_id: clientId, name, email, phone })
    .select('id')
    .single();
  if (customerError || !customer) {
    return bad('Could not record the submission.', 500);
  }

  const { data: lead, error: leadError } = await svc
    .from('leads')
    // `source_kind` was added by migration 0043 and won't appear in the
    // generated DB types until type-gen is re-run.
    .insert({
      client_id: clientId,
      customer_id: customer.id,
      customer_name_snapshot: name,
      customer_phone_snapshot: phone,
      status: 'new',
      urgency: 'none',
      source: sourceLabel,
      source_kind: cleanSourceKind,
      source_funnel_id: cleanFunnelId,
      submission_id: cleanSubmissionId,
    } as unknown as never)
    .select('id')
    .single();
  if (leadError || !lead) {
    return bad('Could not record the submission.', 500);
  }

  const { error: eventError } = await svc.from('lead_events').insert({
    lead_id: lead.id,
    kind: 'form_submitted',
    occurred_at: new Date().toISOString(),
    actor_user_id: null,
    payload: {
      source: sourceLabel,
      // `leadRole` round-trips so the automation render-context resolver can
      // prefer the tag over a label-regex match (`{{lead.service}}`).
      fields: cleanFields.map((f) => ({
        label: f.label,
        value: f.value,
        type: f.type,
        ...(f.leadRole ? { leadRole: f.leadRole } : {}),
      })),
      attachments: cleanFields
        .filter((f) => !!f.imagePath)
        .map((f) => ({ fieldId: f.fieldId, label: f.label, path: f.imagePath })),
    },
  });
  if (eventError) {
    return bad('Could not record the submission.', 500);
  }

  // Phase 8 Session 1 — the lead INSERT trigger fires an automation_trigger
  // job. The engine resolves matching enabled automations and fires:
  //   • lead_acknowledgment_sms   (template lead_acknowledgment, if phone)
  //   • lead_acknowledgment_email (template lead_followup, if email)
  //   • operator_lead_notification (replaces the 0063 direct enqueue)
  // No application-level enqueue is needed here.

  return NextResponse.json({ ok: true, leadId: lead.id });
}
