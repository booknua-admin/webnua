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
// the body, otherwise the request is rejected. Mirrors the editor-side
// `submitLead(existingLeadId)` branch in `lib/leads/queries.tsx`.
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
  leadRole?: 'name' | 'email' | 'phone';
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
    raw.leadRole === 'name' || raw.leadRole === 'email' || raw.leadRole === 'phone'
      ? raw.leadRole
      : undefined;
  return {
    fieldId: typeof raw.fieldId === 'string' ? raw.fieldId : '',
    label: raw.label.slice(0, 200),
    type: raw.type,
    value,
    leadRole: role,
    imagePath:
      typeof raw.imagePath === 'string' && raw.imagePath
        ? raw.imagePath
        : undefined,
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

  const { clientId, source, fields, submissionId, existingLeadId } =
    (body ?? {}) as {
      clientId?: unknown;
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
    typeof submissionId === 'string' && UUID_RE.test(submissionId)
      ? submissionId
      : null;
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
    typeof source === 'string' && source.trim()
      ? source.trim().slice(0, 120)
      : 'Website form';

  const svc = getServiceClient();

  // Verify the client exists — a fabricated clientId is rejected.
  const { data: client } = await svc
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .maybeSingle();
  if (!client) return bad('Unknown client.', 404);

  // Cross-step path: append to an existing lead. Cross-tenant guard — the
  // lead must belong to the same client (a malicious caller can't update an
  // unrelated tenant's lead by injecting a guessed UUID). Lead-not-found and
  // wrong-client both surface as a generic 400 so neither leaks lead existence.
  // Per-funnel scoping is the strongest check the current schema supports —
  // `leads` carries no `funnel_id` column today; when it does, tighten here.
  if (cleanExistingLeadId) {
    const { data: existing } = await svc
      .from('leads')
      .select('id, client_id')
      .eq('id', cleanExistingLeadId)
      .maybeSingle();
    if (!existing || existing.client_id !== clientId) {
      return bad('Unknown lead reference.', 400);
    }
    const { error: eventError } = await svc.from('lead_events').insert({
      lead_id: existing.id,
      kind: 'form_submitted',
      occurred_at: new Date().toISOString(),
      actor_user_id: null,
      payload: {
        source: sourceLabel,
        submissionId: cleanSubmissionId,
        fields: cleanFields.map((f) => ({
          label: f.label,
          value: f.value,
          type: f.type,
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
    .insert({
      client_id: clientId,
      customer_id: customer.id,
      customer_name_snapshot: name,
      customer_phone_snapshot: phone,
      status: 'new',
      urgency: 'none',
      source: sourceLabel,
      submission_id: cleanSubmissionId,
    })
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
      fields: cleanFields.map((f) => ({
        label: f.label,
        value: f.value,
        type: f.type,
      })),
      attachments: cleanFields
        .filter((f) => !!f.imagePath)
        .map((f) => ({ fieldId: f.fieldId, label: f.label, path: f.imagePath })),
    },
  });
  if (eventError) {
    return bad('Could not record the submission.', 500);
  }

  return NextResponse.json({ ok: true, leadId: lead.id });
}
